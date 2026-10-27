<?php
// Punto de entrada único de la API AlquileresFsa
header("Content-Type: application/json; charset=utf-8");

require_once __DIR__ . "/config/Database.php";
require_once __DIR__ . "/controllers/AuthController.php";
require_once __DIR__ . "/controllers/PropiedadController.php";

$base   = "/alquilerFsa/api";
$ruta   = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);
$ruta   = "/" . trim(substr($ruta, strlen($base)), "/");
$metodo = $_SERVER["REQUEST_METHOD"];

try {
    $db = (new Database())->conectar();

    switch ("$metodo $ruta") {
        case "GET /ping":
            echo json_encode(["msj" => "API AlquileresFsa funcionando"]);
            break;

        case "POST /auth/register":
            (new AuthController($db))->register();
            break;

        case "POST /auth/login":
            (new AuthController($db))->login();
            break;

        case "GET /propiedades":
            (new PropiedadController($db))->listar();
            break;

        case "GET /propiedades/buscar":
            (new PropiedadController($db))->buscar();
            break;

        case "GET /propiedades/detalle":
            (new PropiedadController($db))->detalle();
            break;

        case "POST /propiedades/crear":
            (new PropiedadController($db))->crear();
            break;

        case "PUT /propiedades/editar":
            (new PropiedadController($db))->editar();
            break;

        case "DELETE /propiedades/borrar":
            (new PropiedadController($db))->borrar();
            break;

        case "POST /propiedades/fotos/agregar":
            (new PropiedadController($db))->agregarFotos();
            break;

        case "DELETE /propiedades/fotos/borrar":
            (new PropiedadController($db))->borrarFoto();
            break;

        default:
            http_response_code(404);
            echo json_encode(["error" => "Ruta no encontrada"]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Error interno del servidor"]);
}