<?php
// Genera y valida tokens JWT (algoritmo HS256) sin librerías externas
class Jwt
{
    // Clave secreta con la que se firma. Solo la conoce el servidor.
    private static string $secreto = "alquileresfsa_clave_secreta_2026_cambiar";

    // Base64 "seguro para URL": cambia + / por - _ y quita los =
    private static function b64(string $d): string
    {
        return rtrim(strtr(base64_encode($d), "+/", "-_"), "=");
    }

    private static function b64dec(string $d): string
    {
        return base64_decode(strtr($d, "-_", "+/"));
    }

    // Crea el token: cabecera.datos.firma
    public static function generar(array $datos, int $duracion = 3600): string
    {
        $cabecera = self::b64(json_encode(["alg" => "HS256", "typ" => "JWT"]));

        $datos["iat"] = time();              // cuándo se emitió
        $datos["exp"] = time() + $duracion;  // cuándo vence (1 hora)
        $cuerpo = self::b64(json_encode($datos));

        // La firma se calcula con HMAC-SHA256 y la clave secreta
        $firma = self::b64(hash_hmac("sha256", "$cabecera.$cuerpo", self::$secreto, true));

        return "$cabecera.$cuerpo.$firma";
    }

    // Devuelve los datos del token si es válido; null si fue alterado o venció
    public static function validar(string $token): ?array
    {
        $partes = explode(".", $token);
        if (count($partes) !== 3) {
            return null;
        }
        [$cabecera, $cuerpo, $firma] = $partes;

        $esperada = self::b64(hash_hmac("sha256", "$cabecera.$cuerpo", self::$secreto, true));
        // hash_equals compara sin filtrar información por tiempo de respuesta
        if (!hash_equals($esperada, $firma)) {
            return null;
        }

        $datos = json_decode(self::b64dec($cuerpo), true);
        if (!$datos || ($datos["exp"] ?? 0) < time()) {
            return null;
        }
        return $datos;
    }
}