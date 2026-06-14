const pool = require('../config/database');

// Helper dinámico para detectar columnas reales en Azure
const descubrirColumnas = async () => {
  try {
    const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'productos'
    `);
    const columnas = res.rows.map(c => c.column_name);
    return {
      precioCol: columnas.includes('precio_venta') ? 'precio_venta' : (columnas.includes('precio') ? 'precio' : null),
      stockCol: columnas.includes('stock') ? 'stock' : (columnas.includes('existencias') ? 'existencias' : (columnas.includes('cantidad') ? 'cantidad' : null)),
      imagenCol: columnas.includes('imagen_url') ? 'imagen_url' : (columnas.includes('imagen') ? 'imagen' : null)
    };
  } catch (e) {
    return { precioCol: null, stockCol: null, imagenCol: null };
  }
};

/**
 * 🔍 1. OBTENER TODOS LOS PRODUCTOS ACTIVOS (GET)
 */
const getAll = async (_req, res) => {
  let rows = [];
  try {
    const result = await pool.query('SELECT * FROM productos WHERE activo = true ORDER BY id DESC');
    rows = result.rows || [];
  } catch (err) {
    console.error("🔥 Error crítico absoluto leyendo la tabla de productos en Azure:", err.message);
    return res.status(200).json([]); 
  }

  const productosAdaptados = rows.map(prod => {
    const precioFinal = Number(prod.precio_venta || prod.precio_vta || prod.precio || prod.price || 0);
    const stockFinal = Number(prod.stock || prod.existencias || prod.cantidad || prod.cant || 0);
    const barcode = prod.codigo_barras || prod.codigobarras || 'S/C';
    const urlImagen = prod.imagen_url || prod.imagen || '';

    return {
      id: prod.id,
      codigo_barras: barcode,
      nombre: prod.nombre || 'Producto sin nombre',
      descripcion: prod.descripcion || '',
      precio_venta: precioFinal,
      precio: precioFinal, 
      stock: stockFinal,
      existencias: stockFinal, 
      categoria_id: prod.categoria_id || null,
      categoria_nombre: prod.categoria_nombre || 'General',
      imagen_url: urlImagen,
      imagen: urlImagen,
      activo: prod.activo !== undefined ? prod.activo : true
    };
  });

  return res.json(productosAdaptados);
};

/**
 * 🚀 2. REGISTRAR UN NUEVO PRODUCTO (POST)
 */
const create = async (req, res) => {
  try {
    const { nombre, descripcion, precio_venta, stock, categoria_id, imagen_url, uploads } = req.body;
    const fotoA_Guardar = imagen_url || uploads || null;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre del producto es requerido.' });
    }

    const { precioCol, stockCol, imagenCol } = await descubrirColumnas();
    const pCol = precioCol || 'precio';
    const sCol = stockCol || 'stock';
    const iCol = imagenCol || 'imagen_url';

    try {
      const query = `
        INSERT INTO productos (nombre, descripcion, ${pCol}, ${sCol}, categoria_id, ${iCol})
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const result = await pool.query(query, [
        nombre.trim(),
        descripcion ? descripcion.trim() : null,
        precio_venta || 0,
        stock || 0,
        categoria_id || null,
        fotoA_Guardar
      ]);
      return res.status(201).json(result.rows[0]);
    } catch (dbErr) {
      console.warn("⚠️ Error al insertar imagen en Azure. Reintentando almacenamiento seguro sin imagen...");
      const querySeguro = `
        INSERT INTO productos (nombre, descripcion, ${pCol}, ${sCol}, categoria_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const resultSeguro = await pool.query(querySeguro, [
        nombre.trim(),
        descripcion ? descripcion.trim() : null,
        precio_venta || 0,
        stock || 0,
        categoria_id || null
      ]);
      return res.status(201).json(resultSeguro.rows[0]);
    }
  } catch (err) {
    console.error("❌ ERROR EN POST /api/products:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * 🔄 3. ACTUALIZAR UN PRODUCTO (PUT)
 */
const update = async (req, res) => {
  try {
    const { nombre, descripcion, precio_venta, stock, categoria_id, imagen_url, uploads } = req.body;
    
    // Si viene una imagen vacía o nula, mandamos null para limpiar la base de datos limpiamente
    const fotoA_Guardar = imagen_url || uploads || null;

    const { precioCol, stockCol, imagenCol } = await descubrirColumnas();
    const pCol = precioCol || 'precio';
    const sCol = stockCol || 'stock';
    const iCol = imagenCol || 'imagen_url';

    try {
      // 🚨 CORRECCIÓN: Se eliminó el COALESCE de la imagen para permitir sobrescribir y cambiar de foto fluidamente
      const query = `
        UPDATE productos 
        SET nombre = COALESCE($1, nombre),
            descripcion = COALESCE($2, descripcion),
            ${pCol} = COALESCE($3, ${pCol}),
            ${sCol} = COALESCE($4, ${sCol}),
            categoria_id = COALESCE($5, categoria_id),
            ${iCol} = $6
        WHERE id = $7
        RETURNING *
      `;
      const result = await pool.query(query, [
        nombre ? nombre.trim() : null,
        descripcion ? descripcion.trim() : null,
        precio_venta !== undefined ? precio_venta : null,
        stock !== undefined ? stock : null,
        categoria_id !== undefined ? categoria_id : null,
        fotoA_Guardar,
        req.params.id
      ]);

      if (!result.rows.length) return res.status(404).json({ error: 'Producto no encontrado.' });
      return res.json(result.rows[0]);

    } catch (dbErr) {
      console.error("❌ Error de almacenamiento físico en Azure:", dbErr.message);
      
      // Fallback definitivo si la cadena de texto excede las cuotas límites de la infraestructura Cloud
      const querySeguro = `
        UPDATE productos 
        SET nombre = COALESCE($1, nombre),
            descripcion = COALESCE($2, descripcion),
            ${pCol} = COALESCE($3, ${pCol}),
            ${sCol} = COALESCE($4, ${sCol}),
            categoria_id = COALESCE($5, categoria_id)
        WHERE id = $6
        RETURNING *
      `;
      const resultSeguro = await pool.query(querySeguro, [
        nombre ? nombre.trim() : null,
        descripcion ? descripcion.trim() : null,
        precio_venta,
        stock,
        categoria_id,
        req.params.id
      ]);

      if (!resultSeguro.rows.length) return res.status(404).json({ error: 'Producto no encontrado.' });
      return res.json(resultSeguro.rows[0]);
    }
  } catch (err) {
    console.error("❌ ERROR EN PUT /api/products:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * 🗑️ 4. ELIMINAR/DESACTIVAR PRODUCTO (DELETE)
 */
const remove = async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE productos SET activo = false WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'El producto no existe.' });
    return res.json({ message: 'Producto ocultado correctamente.' });
  } catch (err) {
    console.error("❌ ERROR EN DELETE /api/products:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getAll, create, update, remove };