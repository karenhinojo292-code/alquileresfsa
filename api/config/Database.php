<?php

class Database
{
    private string $host = "localhost";
    private string $db   = "alquileresfsa";
    private string $user = "root";
    private string $pass = "";          
    private ?PDO $conexion = null;

    public function conectar(): PDO
    {
        if ($this->conexion === null) {
            $dsn = "mysql:host={$this->host};dbname={$this->db};charset=utf8mb4";
            $this->conexion = new PDO($dsn, $this->user, $this->pass, [
                
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
              
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
        }
        return $this->conexion;
    }
}