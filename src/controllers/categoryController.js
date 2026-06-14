const pool = require('../config/database');

/**
 * 🔍 OBTENER TODAS LAS CATEGORÍAS (GET)
 * Trae las categorías desde Azure sin consultar la columna 'activo' que no existe.
 */
const getAll = async (_req, res) => {
  try {
    // 🛡️ Consulta limpia usando las columnas reales de tu schema.sql
    const result = await pool.query(
      'SELECT id, nombre, descripcion, fecha_creacion FROM categorias ORDER BY nombre ASC'
    );
    
    // Le agregamos la propiedad 'activo: true' en memoria por si el frontend la necesita
    const categoriasAdaptadas = result.rows.map(cat => ({
      ...cat,
      activo: true
    }));

    return res.json(categoriasAdaptadas);
  } catch (err) {
    console.error("❌ ERROR EN GET /api/categories:", err.message);
    return res.status(500).json({ 
      error: "Error en el clúster de Azure al leer las categorías.",
      detalle: err.message 
    });
  }
};

/**
 * 🚀 CREAR NUEVA CATEGORÍA (POST)
 */
const create = async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre de la categoría es requerido.' });
    }

    const result = await pool.query(
      'INSERT INTO categorias (nombre, descripcion) VALUES ($1, $2) RETURNING id, nombre, descripcion, fecha_creacion',
      [nombre.trim(), descripcion ? descripcion.trim() : null]
    );
    
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ ERROR EN POST /api/categories:", err.message);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Esta categoría ya existe.' });
    }
    return res.status(500).json({ error: err.message });
  }
};

/**
 * 🔄 ACTUALIZAR CATEGORÍA (PUT)
 */
const update = async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    
    // COALESCE evita que se pisen los datos con NULL si no se envían en el body
    const result = await pool.query(
      `UPDATE categorias 
       SET nombre = COALESCE($1, nombre), 
           descripcion = COALESCE($2, descripcion) 
       WHERE id = $3 
       RETURNING id, nombre, descripcion, fecha_creacion`,
      [nombre ? nombre.trim() : null, descripcion ? descripcion.trim() : null, req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Categoría no encontrada.' });
    }
    
    return res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ ERROR EN PUT /api/categories:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * 🗑️ ELIMINAR CATEGORÍA (DELETE)
 * Cambiado a DELETE real ya que no existe la columna 'activo' en tu tabla de Azure.
 */
const remove = async (req, res) => {
  try {
    // 🛡️ Borrado físico seguro en Azure PostgreSQL
    const result = await pool.query(
      'DELETE FROM categorias WHERE id = $1 RETURNING id', 
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'La categoría que intentas eliminar no existe.' });
    }

    return res.json({ message: 'Categoría eliminada correctamente de Azure.' });
  } catch (err) {
    console.error("❌ ERROR EN DELETE /api/categories:", err.message);
    
    // Captura por si la categoría ya está amarrada a un producto en otra tabla (Llave foránea)
    if (err.code === '23503') {
      return res.status(400).json({ 
        error: 'No se puede eliminar la categoría porque contiene productos asociados en el inventario.' 
      });
    }
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getAll, create, update, remove };
