<?php
require_once __DIR__ . "/../models/Propiedad.php";
require_once __DIR__ . "/../middleware/AuthMiddleware.php";

class PropiedadController
{
    private const MIN_FOTOS = 2;
    private const MAX_FOTOS = 6;
    private const MAX_BYTES = 3 * 1024 * 1024; // 3 MB por foto

    private Propiedad $propiedad;

    public function __construct(PDO $db)
    {
        $this->propiedad = new Propiedad($db);
    }

    // GET /propiedades (RF03)
    public function listar(): void
    {
        $this->responder(200, $this->propiedad->listarDisponibles());
    }

    // GET /propiedades/buscar?ambientes=... (RF04)
    public function buscar(): void
    {
        $ambientes = $_GET["ambientes"] ?? "";

        if ($ambientes === "") {
            $this->responder(400, ["error" => "Indique la cantidad de ambientes"]);
        }
        if (!ctype_digit((string)$ambientes)) {
            $this->responder(400, ["error" => "Ambientes debe ser un número"]);
        }

        $resultado = $this->propiedad->buscar((int)$ambientes);

        if (count($resultado) === 0) {
            $this->responder(404, ["error" => "No se encontraron propiedades"]);
        }
        $this->responder(200, $resultado);
    }

    // GET /propiedades/detalle?id=1 (RF05)
    public function detalle(): void
    {
        $id = $_GET["id"] ?? "";

        if ($id === "" || !ctype_digit((string)$id)) {
            $this->responder(400, ["error" => "Debe indicar un id numérico"]);
        }

        $ficha = $this->propiedad->obtenerDetalle((int)$id);

        if ($ficha === null) {
            $this->responder(404, ["error" => "Propiedad no encontrada"]);
        }
        $this->responder(200, $ficha);
    }

    // POST /propiedades/crear (RF06) - solo rol Propietario
    // Llega como multipart/form-data: textos en $_POST y fotos en $_FILES["fotos"]
    public function crear(): void
    {
        $usuario = AuthMiddleware::exigirRol(["Propietario"]);

        $direccion    = trim((string)($_POST["direccion"] ?? ""));
        $precio       = trim((string)($_POST["precio"] ?? ""));
        $habitaciones = trim((string)($_POST["habitaciones"] ?? ""));
        $descripcion  = trim((string)($_POST["descripcion"] ?? "")) ?: null;

        if ($direccion === "" || $precio === "" || $habitaciones === "") {
            $this->responder(400, ["error" => "Datos incompletos"]);
        }
        if (!is_numeric($precio) || $precio <= 0) {
            $this->responder(400, ["error" => "El precio debe ser un número mayor a 0"]);
        }
        if (!ctype_digit($habitaciones)) {
            $this->responder(400, ["error" => "Habitaciones debe ser un número entero"]);
        }

        // --- Fotos: cantidad ---
        $fotos = $this->normalizarFotos();
        if (count($fotos) < self::MIN_FOTOS) {
            $this->responder(400, ["error" => "Debe subir al menos " . self::MIN_FOTOS . " fotos del inmueble"]);
        }
        if (count($fotos) > self::MAX_FOTOS) {
            $this->responder(400, ["error" => "Puede subir como máximo " . self::MAX_FOTOS . " fotos"]);
        }

        // --- Fotos: validar todas y guardarlas ---
        [$rutas, $archivos] = $this->guardarFotos($fotos);

        // --- Crear propiedad y fotos juntas; el propietario sale del token ---
        try {
            $id = $this->propiedad->crearConImagenes(
                $direccion, (float)$precio, (int)$habitaciones,
                $descripcion, $usuario["id"], $rutas
            );
        } catch (PDOException $e) {
            $this->borrarArchivos($archivos);
            $this->responder(500, ["error" => "Error interno del servidor"]);
        }

        $this->responder(201, [
            "msj" => "Anuncio creado exitosamente",
            "id" => $id,
            "fotos" => count($rutas),
        ]);
    }

    // PUT /propiedades/editar (RF07) - solo el Propietario dueño del anuncio
    public function editar(): void
    {
        $usuario = AuthMiddleware::exigirRol(["Propietario"]);
        $datos = $this->leerJson();

        $id = $datos["id"] ?? "";
        if ($id === "" || !ctype_digit((string)$id)) {
            $this->responder(400, ["error" => "Debe indicar el id de la propiedad"]);
        }

        $actual = $this->propiedad->obtenerPorId((int)$id);
        if ($actual === null) {
            $this->responder(404, ["error" => "Propiedad no encontrada"]);
        }
        // Solo puede editar sus propios anuncios
        if ((int)$actual["id_propietario"] !== (int)$usuario["id"]) {
            $this->responder(403, ["error" => "No puede modificar anuncios de otro propietario"]);
        }

        // Se arma la lista de campos a modificar, validando cada uno
        $campos = [];

        foreach (["direccion", "descripcion"] as $texto) {
            if (array_key_exists($texto, $datos)) {
                $valor = trim((string)$datos[$texto]);
                if ($valor === "" && $texto !== "descripcion") {
                    $this->responder(400, ["error" => "El campo $texto no puede estar vacío"]);
                }
                $campos[$texto] = $valor;
            }
        }
        if (array_key_exists("precio", $datos)) {
            if (!is_numeric($datos["precio"]) || $datos["precio"] <= 0) {
                $this->responder(400, ["error" => "El precio debe ser un número mayor a 0"]);
            }
            $campos["precio"] = (float)$datos["precio"];
        }
        if (array_key_exists("habitaciones", $datos)) {
            if (!ctype_digit((string)$datos["habitaciones"])) {
                $this->responder(400, ["error" => "Habitaciones debe ser un número entero"]);
            }
            $campos["habitaciones"] = (int)$datos["habitaciones"];
        }
        if (array_key_exists("disponible", $datos)) {
            $v = $datos["disponible"];
            if (is_bool($v)) {
                $campos["disponible"] = (int)$v;
            } elseif (in_array($v, [0, 1, "0", "1"], true)) {
                $campos["disponible"] = (int)$v;
            } else {
                $this->responder(400, ["error" => "Disponible debe ser true o false"]);
            }
        }

        if (count($campos) === 0) {
            $this->responder(400, ["error" => "No se indicaron datos para modificar"]);
        }

        $this->propiedad->actualizar((int)$id, $campos);
        $this->responder(200, ["msj" => "Anuncio actualizado"]);
    }

    // DELETE /propiedades/borrar (RF08 y RF09) - Propietario (el suyo) o Administrador (cualquiera)
    public function borrar(): void
    {
        $usuario = AuthMiddleware::exigirRol(["Propietario", "Administrador"]);
        $datos = $this->leerJson();

        $id = $datos["id"] ?? "";
        if ($id === "" || !ctype_digit((string)$id)) {
            $this->responder(400, ["error" => "Debe indicar el id de la propiedad"]);
        }

        $actual = $this->propiedad->obtenerPorId((int)$id);
        if ($actual === null) {
            $this->responder(404, ["error" => "Propiedad no encontrada"]);
        }
        // El propietario solo puede dar de baja lo suyo; el administrador, todo
        if ($usuario["rol"] === "Propietario" && (int)$actual["id_propietario"] !== (int)$usuario["id"]) {
            $this->responder(403, ["error" => "No puede borrar anuncios de otro propietario"]);
        }

        $this->propiedad->darDeBaja((int)$id);
        $this->responder(200, ["msj" => "Publicación removida"]);
    }

    // POST /propiedades/fotos/agregar - solo el Propietario dueño
    // Llega como multipart/form-data: "id" en $_POST y las fotos nuevas en $_FILES["fotos"]
    public function agregarFotos(): void
    {
        $usuario = AuthMiddleware::exigirRol(["Propietario"]);

        $id = $_POST["id"] ?? "";
        if ($id === "" || !ctype_digit((string)$id)) {
            $this->responder(400, ["error" => "Debe indicar el id de la propiedad"]);
        }
        $actual = $this->propiedad->obtenerPorId((int)$id);
        if ($actual === null) {
            $this->responder(404, ["error" => "Propiedad no encontrada"]);
        }
        if ((int)$actual["id_propietario"] !== (int)$usuario["id"]) {
            $this->responder(403, ["error" => "No puede modificar anuncios de otro propietario"]);
        }

        $fotos = $this->normalizarFotos();
        if (count($fotos) === 0) {
            $this->responder(400, ["error" => "No se recibió ninguna foto"]);
        }
        $total = $this->propiedad->contarImagenes((int)$id) + count($fotos);
        if ($total > self::MAX_FOTOS) {
            $this->responder(400, ["error" => "Un anuncio puede tener como máximo " . self::MAX_FOTOS . " fotos"]);
        }

        [$rutas, $archivos] = $this->guardarFotos($fotos);

        try {
            $this->propiedad->agregarImagenes((int)$id, $rutas);
        } catch (PDOException $e) {
            $this->borrarArchivos($archivos);
            $this->responder(500, ["error" => "Error interno del servidor"]);
        }

        $this->responder(201, [
            "msj" => "Fotos agregadas",
            "imagenes" => $this->propiedad->listarImagenes((int)$id),
        ]);
    }

    // DELETE /propiedades/fotos/borrar - solo el Propietario dueño; deben quedar al menos 2 fotos
    public function borrarFoto(): void
    {
        $usuario = AuthMiddleware::exigirRol(["Propietario"]);
        $datos = $this->leerJson();

        $idImagen = $datos["id_imagen"] ?? "";
        if ($idImagen === "" || !ctype_digit((string)$idImagen)) {
            $this->responder(400, ["error" => "Debe indicar el id de la foto"]);
        }
        $imagen = $this->propiedad->obtenerImagen((int)$idImagen);
        if ($imagen === null) {
            $this->responder(404, ["error" => "Foto no encontrada"]);
        }

        $idPropiedad = (int)$imagen["id_propiedad"];
        $actual = $this->propiedad->obtenerPorId($idPropiedad);
        if ($actual === null || (int)$actual["id_propietario"] !== (int)$usuario["id"]) {
            $this->responder(403, ["error" => "No puede modificar anuncios de otro propietario"]);
        }
        if ($this->propiedad->contarImagenes($idPropiedad) <= self::MIN_FOTOS) {
            $this->responder(400, ["error" => "El anuncio debe tener al menos " . self::MIN_FOTOS . " fotos. Agregue otra antes de quitar esta"]);
        }

        $this->propiedad->borrarImagen((int)$idImagen);

        // También se borra el archivo (basename evita rutas raras)
        $archivo = __DIR__ . "/../uploads/" . basename($imagen["ruta_url"]);
        if (is_file($archivo)) {
            unlink($archivo);
        }

        $this->responder(200, [
            "msj" => "Foto eliminada",
            "imagenes" => $this->propiedad->listarImagenes($idPropiedad),
        ]);
    }

    // Valida TODAS las fotos antes de guardar alguna y las guarda con nombre aleatorio.
    // Devuelve [rutas para la base, rutas de archivo en disco]. Si algo falla, responde error y corta.
    private function guardarFotos(array $fotos): array
    {
        $extensiones = [];
        foreach ($fotos as $i => $foto) {
            if ($foto["error"] !== UPLOAD_ERR_OK) {
                $this->responder(400, ["error" => "Error al recibir la foto " . ($i + 1)]);
            }
            if ($foto["size"] > self::MAX_BYTES) {
                $this->responder(400, ["error" => "La foto " . ($i + 1) . " supera los 3 MB"]);
            }
            // Se mira el contenido real del archivo, no el nombre que trae
            $info = @getimagesize($foto["tmp_name"]);
            $mime = $info["mime"] ?? "";
            if ($mime === "image/jpeg") {
                $extensiones[$i] = "jpg";
            } elseif ($mime === "image/png") {
                $extensiones[$i] = "png";
            } else {
                $this->responder(400, ["error" => "La foto " . ($i + 1) . " debe ser JPG o PNG"]);
            }
        }

        $carpeta = __DIR__ . "/../uploads/";
        $rutas = [];
        $archivos = [];
        foreach ($fotos as $i => $foto) {
            $nombre = bin2hex(random_bytes(16)) . "." . $extensiones[$i];
            if (!move_uploaded_file($foto["tmp_name"], $carpeta . $nombre)) {
                $this->borrarArchivos($archivos);
                $this->responder(500, ["error" => "No se pudo guardar la foto " . ($i + 1)]);
            }
            $archivos[] = $carpeta . $nombre;
            $rutas[] = "uploads/" . $nombre;
        }
        return [$rutas, $archivos];
    }

    // Convierte $_FILES["fotos"] (formato raro de PHP) en una lista simple de archivos
    private function normalizarFotos(): array
    {
        $fotos = [];
        if (!isset($_FILES["fotos"])) {
            return $fotos;
        }
        $f = $_FILES["fotos"];

        if (is_array($f["name"])) {
            foreach ($f["name"] as $i => $nombre) {
                if ($f["error"][$i] === UPLOAD_ERR_NO_FILE) {
                    continue;
                }
                $fotos[] = [
                    "tmp_name" => $f["tmp_name"][$i],
                    "error"    => $f["error"][$i],
                    "size"     => $f["size"][$i],
                ];
            }
        } elseif ($f["error"] !== UPLOAD_ERR_NO_FILE) {
            $fotos[] = [
                "tmp_name" => $f["tmp_name"],
                "error"    => $f["error"],
                "size"     => $f["size"],
            ];
        }
        return $fotos;
    }

    // Borra archivos ya guardados (si algo falló a mitad de camino)
    private function borrarArchivos(array $archivos): void
    {
        foreach ($archivos as $archivo) {
            if (is_file($archivo)) {
                unlink($archivo);
            }
        }
    }

    // Lee el cuerpo JSON; si viene vacío o mal formado devuelve un array vacío
    private function leerJson(): array
    {
        $datos = json_decode(file_get_contents("php://input"), true);
        return is_array($datos) ? $datos : [];
    }

    private function responder(int $codigo, array $cuerpo): void
    {
        http_response_code($codigo);
        echo json_encode($cuerpo);
        exit;
    }
}