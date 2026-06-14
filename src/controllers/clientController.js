const db = require('../config/database');

/**
 * 🔍 OBTENER TODOS LOS CLIENTES (GET)
 */
const getAll = async (_req, res) => {
  try {
    // Consultamos la tabla real en Azure
    const resultado = await db.query(
      'SELECT id, rut, nombre, giro, direccion, telefono FROM clientes ORDER BY id DESC'
    );
    
    // 🔄 Mapeo Híbrido: Convertimos el campo 'giro' en 'correo' para que el frontend lo renderice feliz
    const clientesAdaptados = (resultado.rows || []).map(cliente => ({
      id: cliente.id,
      rut: cliente.rut,
      nombre: cliente.nombre,
      correo: cliente.giro || 'sin-correo@pos.com', // Si 'giro' tiene el correo, se lo pasa a la UI
      giro: cliente.giro,
      direccion: cliente.direccion,
      telefono: cliente.telefono
    }));

    return res.json(clientesAdaptados);
  } catch (err) {
    console.error("❌ Error en GET /api/clients (Mapeo Híbrido):", err.message);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * 🚀 REGISTRAR NUEVO CLIENTE (POST)
 */
const create = async (req, res) => {
  // Capturamos 'correo' enviado por tu interfaz gráfica
  const { nombre, rut, correo, giro, direccion, telefono } = req.body;

  if (!rut || !nombre) {
    return res.status(400).json({ error: 'El RUT y el Nombre son obligatorios.' });
  }

  try {
    // 🔄 Zona de rescate de datos: Guardamos el 'correo' del formulario en la columna 'giro' de Azure
    const correoDestino = correo || giro;

    const nuevoCliente = await db.query(
      `INSERT INTO clientes (nombre, rut, giro, direccion, telefono) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (rut) DO NOTHING 
       RETURNING *`,
      [
        nombre.trim(), 
        rut.trim(), 
        correoDestino ? correoDestino.trim() : null, 
        direccion ? direccion.trim() : null, 
        telefono ? telefono.trim() : null
      ]
    );

    if (!nuevoCliente.rows.length) {
      return res.status(409).json({ error: 'El RUT ya se encuentra registrado.' });
    }

    const creado = nuevoCliente.rows[0];
    
    // Devolvemos el objeto con el formato exacto que espera tu vista
    return res.status(201).json({
      id: creado.id,
      rut: creado.rut,
      nombre: creado.nombre,
      correo: creado.giro
    });
  } catch (err) {
    console.error("❌ Error al registrar cliente:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * 🗑️ ELIMINAR UN CLIENTE (DELETE)
 */
const remove = async (req, res) => {
  const { id } = req.params;
  try {
    const resultado = await db.query('DELETE FROM clientes WHERE id = $1 RETURNING id', [id]);
    
    if (!resultado.rows.length) {
      return res.status(404).json({ error: 'El cliente no existe.' });
    }

    return res.json({ mensaje: 'Cliente removido del directorio' });
  } catch (err) {
    console.error("❌ Error al eliminar cliente:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getAll, create, remove };
