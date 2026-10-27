<?php
// Modelo: mapea la tabla usuarios y encapsula el acceso a datos
class Usuario
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    // Devuelve el id del rol a partir de su nombre, o null si no existe
    public function obtenerIdRol(string $nombreRol): ?int
    {
        $st = $this->db->prepare("SELECT id_rol FROM roles WHERE nombre_rol = ?");
        $st->execute([$nombreRol]);
        $fila = $st->fetch();
        return $fila ? (int)$fila["id_rol"] : null;
    }

    public function existeEmail(string $email): bool
    {
        $st = $this->db->prepare("SELECT 1 FROM usuarios WHERE email = ?");
        $st->execute([$email]);
        return (bool)$st->fetch();
    }

    // Un mismo DNI no puede registrarse dos veces
    public function existeDni(string $dni): bool
    {
        $st = $this->db->prepare("SELECT 1 FROM usuarios WHERE dni = ?");
        $st->execute([$dni]);
        return (bool)$st->fetch();
    }

    // Consulta preparada: evita inyección SQL. Los datos de verificación son opcionales
    // porque solo los exige el registro de Propietarios.
    public function crear(string $nombre, string $email, string $passHash, ?string $telefono,
                          int $idRol, ?string $dni, ?string $direccion, int $declaracionJurada): bool
    {
        $st = $this->db->prepare(
            "INSERT INTO usuarios
             (nombre, email, password, telefono, id_rol, dni, direccion, declaracion_jurada)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );
        return $st->execute([$nombre, $email, $passHash, $telefono, $idRol, $dni, $direccion, $declaracionJurada]);
    }

    // Busca un usuario por email y trae también el nombre de su rol
    public function buscarPorEmail(string $email): ?array
    {
        $st = $this->db->prepare(
            "SELECT u.id_usuario, u.nombre, u.email, u.password, u.estado, r.nombre_rol
             FROM usuarios u
             INNER JOIN roles r ON r.id_rol = u.id_rol
             WHERE u.email = ?"
        );
        $st->execute([$email]);
        $fila = $st->fetch();
        return $fila ?: null;
    }
}