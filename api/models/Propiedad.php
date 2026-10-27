<?php
// Modelo: mapea la tabla propiedades
class Propiedad
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    // Lista solo las propiedades disponibles, con su foto de portada (la primera)
    public function listarDisponibles(): array
    {
        $st = $this->db->query(
            "SELECT p.id_propiedad AS id, p.direccion, p.precio, p.habitaciones,
                    (SELECT i.ruta_url FROM imagenes i
                     WHERE i.id_propiedad = p.id_propiedad
                     ORDER BY i.id_imagen LIMIT 1) AS portada
             FROM propiedades p
             WHERE p.disponible = 1
             ORDER BY p.id_propiedad DESC"
        );
        return $st->fetchAll();
    }

    // Busca propiedades disponibles con esa cantidad de habitaciones
    public function buscar(int $habitaciones): array
    {
        $st = $this->db->prepare(
            "SELECT p.id_propiedad AS id, p.direccion, p.precio, p.habitaciones,
                    (SELECT i.ruta_url FROM imagenes i
                     WHERE i.id_propiedad = p.id_propiedad
                     ORDER BY i.id_imagen LIMIT 1) AS portada
             FROM propiedades p
             WHERE p.disponible = 1 AND p.habitaciones = ?
             ORDER BY p.id_propiedad DESC"
        );
        $st->execute([$habitaciones]);
        return $st->fetchAll();
    }

    // Trae todos los datos de una propiedad disponible, con contacto y fotos
    public function obtenerDetalle(int $id): ?array
    {
        $st = $this->db->prepare(
            "SELECT p.id_propiedad AS id, p.direccion, p.precio,
                    p.habitaciones, p.descripcion,
                    u.nombre AS propietario, u.telefono AS contacto, u.email AS email_contacto
             FROM propiedades p
             INNER JOIN usuarios u ON u.id_usuario = p.id_propietario
             WHERE p.id_propiedad = ? AND p.disponible = 1"
        );
        $st->execute([$id]);
        $fila = $st->fetch();
        if (!$fila) {
            return null;
        }

        $fila["imagenes"] = $this->listarImagenes($id);

        return $fila;
    }

    // Busca una propiedad por id, esté disponible o no (sirve para verificar dueño)
    public function obtenerPorId(int $id): ?array
    {
        $st = $this->db->prepare("SELECT * FROM propiedades WHERE id_propiedad = ?");
        $st->execute([$id]);
        $fila = $st->fetch();
        return $fila ?: null;
    }

    // Crea la propiedad y registra sus fotos en una sola transacción:
    // si algo falla, no queda ni la propiedad ni fotos a medias.
    public function crearConImagenes(string $direccion, float $precio,
                                     int $habitaciones, ?string $descripcion,
                                     int $idPropietario, array $rutas): int
    {
        $this->db->beginTransaction();
        try {
            $st = $this->db->prepare(
                "INSERT INTO propiedades
                 (direccion, precio, habitaciones, descripcion, disponible, id_propietario)
                 VALUES (?, ?, ?, ?, 1, ?)"
            );
            $st->execute([$direccion, $precio, $habitaciones, $descripcion, $idPropietario]);
            $id = (int)$this->db->lastInsertId();

            $stImg = $this->db->prepare(
                "INSERT INTO imagenes (ruta_url, id_propiedad) VALUES (?, ?)"
            );
            foreach ($rutas as $ruta) {
                $stImg->execute([$ruta, $id]);
            }

            $this->db->commit();
            return $id;
        } catch (PDOException $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    // Actualiza solo los campos recibidos. Lista blanca: ningún otro campo se puede tocar.
    public function actualizar(int $id, array $campos): bool
    {
        $permitidos = ["direccion", "precio", "habitaciones", "descripcion", "disponible"];
        $sets = [];
        $params = [];

        foreach ($campos as $columna => $valor) {
            if (in_array($columna, $permitidos, true)) {
                $sets[] = "$columna = ?";
                $params[] = $valor;
            }
        }
        if (count($sets) === 0) {
            return false;
        }

        $params[] = $id;
        $st = $this->db->prepare("UPDATE propiedades SET " . implode(", ", $sets) . " WHERE id_propiedad = ?");
        return $st->execute($params);
    }

    // Fotos de una propiedad, con su id (para poder quitarlas)
    public function listarImagenes(int $idPropiedad): array
    {
        $st = $this->db->prepare(
            "SELECT id_imagen AS id, ruta_url FROM imagenes WHERE id_propiedad = ? ORDER BY id_imagen"
        );
        $st->execute([$idPropiedad]);
        return $st->fetchAll();
    }

    public function contarImagenes(int $idPropiedad): int
    {
        $st = $this->db->prepare("SELECT COUNT(*) FROM imagenes WHERE id_propiedad = ?");
        $st->execute([$idPropiedad]);
        return (int)$st->fetchColumn();
    }

    public function obtenerImagen(int $idImagen): ?array
    {
        $st = $this->db->prepare(
            "SELECT id_imagen AS id, ruta_url, id_propiedad FROM imagenes WHERE id_imagen = ?"
        );
        $st->execute([$idImagen]);
        $fila = $st->fetch();
        return $fila ?: null;
    }

    // Agrega fotos a una propiedad ya creada (todas o ninguna)
    public function agregarImagenes(int $idPropiedad, array $rutas): void
    {
        $this->db->beginTransaction();
        try {
            $st = $this->db->prepare("INSERT INTO imagenes (ruta_url, id_propiedad) VALUES (?, ?)");
            foreach ($rutas as $ruta) {
                $st->execute([$ruta, $idPropiedad]);
            }
            $this->db->commit();
        } catch (PDOException $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function borrarImagen(int $idImagen): bool
    {
        $st = $this->db->prepare("DELETE FROM imagenes WHERE id_imagen = ?");
        return $st->execute([$idImagen]);
    }

    // Baja lógica: la fila queda en la base pero deja de mostrarse
    public function darDeBaja(int $id): bool
    {
        $st = $this->db->prepare("UPDATE propiedades SET disponible = 0 WHERE id_propiedad = ?");
        return $st->execute([$id]);
    }
}