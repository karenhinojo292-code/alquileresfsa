<?php
require_once __DIR__ . "/../models/Usuario.php";
require_once __DIR__ . "/../config/Jwt.php";

class AuthController
{
    private Usuario $usuario;

    public function __construct(PDO $db)
    {
        $this->usuario = new Usuario($db);
    }

    // POST /auth/register (RF01)
    public function register(): void
    {
        $datos = json_decode(file_get_contents("php://input"), true);
        if (!is_array($datos)) {
            $datos = [];
        }

        $nombre   = trim((string)($datos["nombre"] ?? ""));
        $email    = trim((string)($datos["email"] ?? ""));
        $pass     = (string)($datos["pass"] ?? "");
        $rol      = (string)($datos["rol"] ?? "");
        $telefono = trim((string)($datos["telefono"] ?? ""));
        $dni      = trim((string)($datos["dni"] ?? ""));
        $direccion = trim((string)($datos["direccion"] ?? ""));
        $declaracion = ($datos["declaracion_jurada"] ?? false) === true;

        // --- Validaciones comunes a todos los roles ---
        if ($nombre === "" || $email === "" || $pass === "" || $rol === "") {
            $this->responder(400, ["error" => "Datos incompletos"]);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->responder(400, ["error" => "Email inválido"]);
        }
        if (strlen($pass) < 6) {
            $this->responder(400, ["error" => "La contraseña debe tener al menos 6 caracteres"]);
        }
        // Nadie puede registrarse como Administrador desde la API
        if (!in_array($rol, ["Inquilino", "Propietario"], true)) {
            $this->responder(400, ["error" => "Rol no permitido"]);
        }
        // Teléfono: 10 dígitos, sin 0 ni 15 adelante (ej: 3704123456)
        if ($telefono !== "" && !$this->telefonoValido($telefono)) {
            $this->responder(400, ["error" => "El teléfono debe tener 10 dígitos con código de área, sin 0 ni 15 (ej: 3704123456)"]);
        }

        // --- Validaciones extra para quien quiere publicar alquileres ---
        if ($rol === "Propietario") {
            if ($telefono === "") {
                $this->responder(400, ["error" => "El teléfono es obligatorio para publicar alquileres"]);
            }
            if (!preg_match('/^\d{7,8}$/', $dni)) {
                $this->responder(400, ["error" => "El DNI debe tener solo números, 7 u 8 dígitos"]);
            }
            if (mb_strlen($direccion) < 10) {
                $this->responder(400, ["error" => "La dirección debe tener al menos 10 caracteres"]);
            }
            if (!$declaracion) {
                $this->responder(400, ["error" => "Debe aceptar la declaración jurada"]);
            }
            if ($this->usuario->existeDni($dni)) {
                $this->responder(409, ["error" => "El DNI ya está registrado"]);
            }
        } else {
            // El Inquilino no guarda datos de verificación
            $dni = "";
            $direccion = "";
            $declaracion = false;
        }

        if ($this->usuario->existeEmail($email)) {
            $this->responder(409, ["error" => "El email ya está registrado"]);
        }

        $idRol = $this->usuario->obtenerIdRol($rol);
        $hash  = password_hash($pass, PASSWORD_BCRYPT);

        $this->usuario->crear(
            $nombre,
            $email,
            $hash,
            $telefono !== "" ? $telefono : null,
            $idRol,
            $dni !== "" ? $dni : null,
            $direccion !== "" ? $direccion : null,
            $declaracion ? 1 : 0
        );

        $this->responder(201, ["msj" => "Usuario registrado"]);
    }

    // POST /auth/login (RF02)
    public function login(): void
    {
        $datos = json_decode(file_get_contents("php://input"), true);
        if (!is_array($datos)) {
            $datos = [];
        }

        $email = trim((string)($datos["email"] ?? ""));
        $pass  = (string)($datos["pass"] ?? "");

        if ($email === "" || $pass === "") {
            $this->responder(400, ["error" => "Datos incompletos"]);
        }

        $user = $this->usuario->buscarPorEmail($email);

        // Mismo mensaje si el email no existe o la clave es incorrecta,
        // así no se revela qué emails están registrados
        if (!$user || !password_verify($pass, $user["password"])) {
            $this->responder(401, ["error" => "Credenciales inválidas"]);
        }
        if ((int)$user["estado"] !== 1) {
            $this->responder(403, ["error" => "Cuenta desactivada"]);
        }

        // El token guarda quién es el usuario y su rol (nunca la contraseña)
        $token = Jwt::generar([
            "id"  => (int)$user["id_usuario"],
            "rol" => $user["nombre_rol"],
        ]);

        $this->responder(200, ["token" => $token, "rol" => $user["nombre_rol"]]);
    }

    // 10 dígitos exactos, que no empiecen con 0 ni con 15
    private function telefonoValido(string $telefono): bool
    {
        return preg_match('/^[1-9]\d{9}$/', $telefono) === 1
            && substr($telefono, 0, 2) !== "15";
    }

    private function responder(int $codigo, array $cuerpo): void
    {
        http_response_code($codigo);
        echo json_encode($cuerpo);
        exit;
    }
}