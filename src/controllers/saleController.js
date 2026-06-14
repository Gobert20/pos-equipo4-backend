const pool = require('../config/database');

/**
 * 🛒 REGISTRAR UNA NUEVA VENTA Y DESCONTAR STOCK
 */
const registrarVentaReal = async (req, res) => {
  const client = await pool.connect();
  try {
    const { usuario_id, cliente_id, productos, metodo_pago } = req.body;

    if (!productos || productos.length === 0) {
      return res.status(400).json({ error: 'El carrito de compras está vacío.' });
    }

    await client.query('BEGIN'); // Inicio de la transacción SQL

    // 1. Calcular Totales (Con el IVA del 19% chileno)
    let calculadoSubtotal = 0;
    productos.forEach(p => {
      const precio = Number(p.precio_venta || 0);
      const cant = Number(p.cantidadActiva || 1);
      calculadoSubtotal += (precio * cant);
    });

    const calculadoIva = Math.round(calculadoSubtotal * 0.19);
    const calculadoTotal = calculadoSubtotal + calculadoIva;

    // 2. Insertar Encabezado de Venta (Columnas exactas de tu DDL)
    const queryVenta = `
      INSERT INTO ventas (usuario_id, cliente_id, subtotal, iva, total, metodo_pago, estado)
      VALUES ($1, $2, $3, $4, $5, $6, 'completada')
      RETURNING *
    `;
    const ventaRes = await client.query(queryVenta, [
      usuario_id || null, 
      cliente_id || null,  
      calculadoSubtotal,
      calculadoIva,
      calculadoTotal,
      metodo_pago || 'efectivo'
    ]);
    
    const ventaId = ventaRes.rows[0].id;

    // 3. Registrar el desglose y DESCONTAR EL STOCK de Azure
    for (const prod of productos) {
      const idProd = prod.id;
      const cant = Number(prod.cantidadActiva);
      const precioUnit = Number(prod.precio_venta);
      const totalItem = precioUnit * cant;

      // Detalle de venta
      await client.query(`
        INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, total_item)
        VALUES ($1, $2, $3, $4, $5)
      `, [ventaId, idProd, cant, precioUnit, totalItem]);

      // Restar stock físico
      await client.query(`
        UPDATE productos 
        SET stock = stock - $1 
        WHERE id = $2
      `, [cant, idProd]);
    }

    await client.query('COMMIT'); // Guardado total en Azure
    return res.status(201).json({ 
      message: 'Venta procesada con éxito. Stock descontado en Azure.', 
      venta: ventaRes.rows[0] 
    });

  } catch (err) {
    await client.query('ROLLBACK'); // Si algo falla, deshace todo para no romper el stock
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

    // Query que amarra el detalle con el nombre real del producto
    const query = `
      SELECT dv.*, p.nombre 
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