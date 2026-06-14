const bcrypt = require('bcryptjs');
const pool = require('../config/database');

/**
 * 🔍 OBTENER TODOS LOS USUARIOS (GET)
 * Trae la lista de operadores desde Azure PostgreSQL de forma segura.
 */
const getAll = async (_req, res) => {
  try {
    // Consulta limpia libre de columnas conflictivas
    const result = await pool.query(
      `SELECT id, nombre, correo
       FROM usuarios 
       ORDER BY id ASC`
    );

    // Mapeo Híbrido Avanzado para compatibilidad total con el frontend
    const usersWithRoles = result.rows.map(user => {
      const correoMinusculas = user.correo ? user.correo.toLowerCase() : '';
      const esAdmin = correoMinusculas.includes('admin');

      return {
        id: user.id,
        nombre: user.nombre,
        correo: user.correo,
        email: user.correo, 
        activo: true, // Forzado en true para renderizado visual seguro
        rol: esAdmin ? 'Administrador' : 'Cajero / Staff',
        rol_id: esAdmin ? 1 : 2
      };
    });

    return res.json(usersWithRoles);
  } catch (err) {
    console.error("❌ ERROR EN GET /api/users:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * 🚀 REGISTRAR UN NUEVO OPERADOR (POST)
 */
const create = async (req, res) => {
  try {
    const { nombre, correo, email, clave, password } = req.body;
    const inputCorreo = correo || email;
    const inputClave = clave || password;

    if (!nombre || !inputCorreo || !inputClave) {
      return res.status(400).json({ error: 'Nombre, correo y contraseña son requeridos.' });
    }
    
    const hash = await bcrypt.hash(inputClave, 10);
    
    const result = await pool.query(
      `INSERT INTO usuarios (nombre, correo, clave)
       VALUES ($1, $2, $3) 
       RETURNING id, nombre, correo`,
      [nombre, inputCorreo.trim(), hash]
    );

    const newUser = result.rows[0];
    const correoMinusculas = newUser.correo ? newUser.correo.toLowerCase() : '';

    return res.status(201).json({
      id: newUser.id,
      nombre: newUser.nombre,
      correo: newUser.correo,
      email: newUser.correo,
      rol: correoMinusculas.includes('admin') ? 'Administrador' : 'Cajero / Staff'
    });
  } catch (err) {
    console.error("❌ ERROR EN POST /api/users:", err.message);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'El correo ya está registrado.' });
    }
    return res.status(500).json({ error: err.message });
  }
};

/**
 * 🔄 ACTUALIZAR DATOS DE UN OPERADOR (PUT)
 */
const update = async (req, res) => {
  try {
    const { nombre, correo, email, clave, password } = req.body;
    const inputCorreo = correo || email;
    const fields = [];
    const values = [];

    if (nombre !== undefined) { fields.push(`nombre = $${fields.length + 1}`); values.push(nombre); }
    if (inputCorreo !== undefined) { fields.push(`correo = $${fields.length + 1}`); values.push(inputCorreo.trim()); }
    
    if (clave || password) {
      const hash = await bcrypt.hash(clave || password, 10);
      fields.push(`clave = $${fields.length + 1}`);
      values.push(hash);
    }

    if (!fields.length) {
      return res.status(400).json({ error: 'No hay campos para actualizar.' });
    }

    values.push(req.params.id);

    const result = await pool.query(
      `UPDATE usuarios 
       SET ${fields.join(', ')} 
       WHERE id = $${values.length}
       RETURNING id, nombre, correo`,
      values
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    
    const updatedUser = result.rows[0];
    const correoMinusculas = updatedUser.correo ? updatedUser.correo.toLowerCase() : '';

    return res.json({
      id: updatedUser.id,
      nombre: updatedUser.nombre,
      correo: updatedUser.correo,
      email: updatedUser.correo,
      rol: correoMinusculas.includes('admin') ? 'Administrador' : 'Cajero / Staff'
    });
  } catch (err) {
    console.error("❌ ERROR EN PUT /api/users:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * 🗑️ ELIMINAR UN OPERADOR (DELETE)
 */
const remove = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM usuarios WHERE id = $1 RETURNING id', [req.params.id]);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    return res.json({ message: 'Usuario eliminado correctamente de Azure.' });
  } catch (err) {
    console.error("❌ ERROR EN DELETE /api/users:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getAll, create, update, remove };
