const { pool } = require('../config/database');

/**
 * 🛒 REGISTRAR UNA NUEVA VENTA Y DESCONTAR STOCK
 */
const registrarVentaReal = async (req, res) => {
  const client = await pool.connect();
  try {
    const { usuario_id, cliente_id, productos, metodo_pago, total: frontendTotal } = req.body;

    if (!productos || productos.length === 0) {
      return res.status(400).json({ error: 'El carrito de compras está vacío.' });
    }

    await client.query('BEGIN'); // Inicio de la transacción SQL

    // 1. Calcular el Total con máxima flexibilidad de nombres
    let calculadoTotal = 0;
    productos.forEach(p => {
      // Intenta leer el precio de cualquier forma posible que use el frontend
      const precio = Number(p.precio_venta || p.precio_unitario || p.precioUnitario || p.precio || p.price || 0);
      // Intenta leer la cantidad de cualquier forma posible
      const cant = Number(p.cantidadActiva || p.cantidad || p.quantity || 1);
      calculadoTotal += (precio * cant);
    });

    // Si el cálculo da 0 pero el frontend nos mandó un total explícito en el body, usamos ese
    if (calculadoTotal === 0 && frontendTotal) {
      calculadoTotal = Number(frontendTotal);
    }

    // 2. Insertar Encabezado de Venta en Azure
    const queryVenta = `
      INSERT INTO ventas (usuario_id, cliente_id, total, metodo_pago, estado)
      VALUES ($1, $2, $3, $4, 'completada')
      RETURNING *
    `;
    const ventaRes = await client.query(queryVenta, [
      usuario_id || null, 
      cliente_id || null,  
      calculadoTotal,
      metodo_pago || 'efectivo'
    ]);
    
    const ventaId = ventaRes.rows[0].id;

    // 3. Registrar desglose y descontar stock
    for (const prod of productos) {
      // Buscar ID del producto de forma flexible
      const idProd = prod.id || prod.producto_id || prod.id_producto;
      const cant = Number(prod.cantidadActiva || prod.cantidad || prod.quantity || 1);
      const precioUnit = Number(prod.precio_venta || prod.precio_unitario || prod.precioUnitario || prod.precio || prod.price || 0);
      const subtotalItem = precioUnit * cant;

      // Detalle de venta en Azure con la columna 'subtotal' obligatoria
      await client.query(`
        INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
        VALUES ($1, $2, $3, $4, $5)
      `, [ventaId, idProd, cant, precioUnit, subtotalItem]);

      // Restar stock físico real en la base de datos
      if (idProd) {
        await client.query(`
          UPDATE productos 
          SET stock = stock - $1 
          WHERE id = $2
        `, [cant, idProd]);
      }
    }

    await client.query('COMMIT'); // Guardado atómico
    return res.status(201).json({ 
      message: 'Venta procesada con éxito y stock sincronizado.', 
      venta: ventaRes.rows[0] 
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ ERROR EN TRANSACCIÓN DE VENTA EN AZURE:", err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

/**
 * 📊 OBTENER TODO EL HISTORIAL DE VENTAS PRINCIPALES
 */
const getAllSales = async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ventas ORDER BY id DESC');
    return res.json(result.rows || []);
  } catch (err) {
    console.error("❌ Error leyendo historial de ventas en Azure:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * 🔍 OBTENER EL DETALLE / DESGLOSE DE UNA VENTA ESPECÍFICA
 */
const getSaleDetails = async (req, res) => {
  try {
    const { id } = req.params; 

    // Reescritura de la query para garantizar traer el nombre del producto real
    const query = `
      SELECT 
        dv.id,
        dv.venta_id,
        dv.producto_id,
        dv.cantidad,
        dv.precio_unitario,
        dv.subtotal,
        COALESCE(p.nombre, 'Producto ' || dv.producto_id) as nombre
      FROM detalle_ventas dv
      LEFT JOIN productos p ON dv.producto_id = p.id
      WHERE dv.venta_id = $1
    `;
    
    const result = await pool.query(query, [id]);
    return res.json(result.rows || []);
  } catch (err) {
    console.error("❌ Error leyendo el desglose de la venta en Azure:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { registrarVentaReal, getAllSales, getSaleDetails };