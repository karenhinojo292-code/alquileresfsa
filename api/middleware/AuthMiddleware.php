<?php
require_once __DIR__ . "/../config/Jwt.php";

// Middleware: valida el token JWT y el rol antes de ejecutar una acción protegida
class AuthMiddleware
{
    // Devuelve los datos del token (id, rol) si todo está bien.
    // Si no, responde 401 o 403 y corta la ejecución.
    public static function exigirRol(array $rolesPermitidos): array
    {
        // El cliente manda: Authorization: Bearer <token>
        $cabecera = $_SERVER["HTTP_AUTHORIZATION"] ?? "";

        if (!preg_match('/^Bearer\s+(.+)$/i', $cabecera, $coincidencia)) {
            self::cortar(401, "Token requerido");
        }

        // Jwt::validar verifica la firma y la fecha de vencimiento
        $datos = Jwt::validar($coincidencia[1]);
        if ($datos === null) {
            self::cortar(401, "Token inválido o vencido");
        }

        // El token es válido, pero ¿su rol tiene permiso?
        if (!in_array($datos["rol"], $rolesPermitidos, true)) {
            self::cortar(403, "No tiene permisos para esta acción");
        }

        return $datos;
    }

    private static function cortar(int $codigo, string $mensaje): void
    {
        http_response_code($codigo);
        echo json_encode(["error" => $mensaje]);
        exit;
    }
}