const pool = require('../config/database');

/** GET /api/reports/summary — Resumen general del dashboard */
const summary = async (_req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const [ventasHoy, ventasMes, totalProductos, totalClientes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS cantidad, COALESCE(SUM(total), 0) AS monto
         FROM ventas WHERE estado = 'completada' AND created_at >= $1`,
        [hoy]
      ),
      pool.query(
        `SELECT COUNT(*) AS cantidad, COALESCE(SUM(total), 0) AS monto
         FROM ventas WHERE estado = 'completada'
         AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())`,
        []
      ),
      pool.query('SELECT COUNT(*) AS total FROM productos WHERE activo = true'),
      pool.query('SELECT COUNT(*) AS total FROM clientes WHERE activo = true'),
    ]);

    res.json({
      ventas_hoy:       { cantidad: Number(ventasHoy.rows[0].cantidad),    monto: Number(ventasHoy.rows[0].monto) },
      ventas_mes:       { cantidad: Number(ventasMes.rows[0].cantidad),    monto: Number(ventasMes.rows[0].monto) },
      total_productos:  Number(totalProductos.rows[0].total),
      total_clientes:   Number(totalClientes.rows[0].total),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** GET /api/reports/sales-by-day?days=30 */
const salesByDay = async (req, res) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 90);
    const result = await pool.query(
      `SELECT DATE(created_at) AS fecha,
              COUNT(*)::int    AS cantidad,
              SUM(total)::int  AS monto
       FROM ventas
       WHERE estado = 'completada'
         AND created_at >= NOW() - ($1 || ' days')::INTERVAL
       GROUP BY DATE(created_at)
       ORDER BY fecha`,
      [days]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** GET /api/reports/top-products?limit=10 */
const topProducts = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const result = await pool.query(
      `SELECT p.nombre,
              SUM(dv.cantidad)::int  AS unidades_vendidas,
              SUM(dv.subtotal)::int  AS ingreso_total
       FROM detalle_ventas dv
       JOIN ventas v    ON dv.venta_id    = v.id
       JOIN productos p ON dv.producto_id = p.id
       WHERE v.estado = 'completada'
       GROUP BY p.id, p.nombre
       ORDER BY unidades_vendidas DESC
       LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** GET /api/reports/sales-by-payment */
const salesByPayment = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT metodo_pago,
              COUNT(*)::int   AS cantidad,
              SUM(total)::int AS monto
       FROM ventas
       WHERE estado = 'completada'
       GROUP BY metodo_pago
       ORDER BY monto DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { summary, salesByDay, topProducts, salesByPayment };
