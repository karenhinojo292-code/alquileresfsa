<?php
echo "Apache y PHP funcionan";
echo "<br>Versión de PHP: " . phpversion();

require_once __DIR__ . "/config/Database.php";

try {
    $db = (new Database())->conectar();
    $roles = $db->query("SELECT * FROM roles")->fetchAll();
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode($roles);
} catch (PDOException $e) {
    echo "Error de conexión: " . $e->getMessage();
}