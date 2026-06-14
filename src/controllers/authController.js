const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

/**
 * POST /api/auth/login
 * Implementación de producción sincronizada con Azure PostgreSQL
 */
const login = async (req, res) => {
  try {
    // Captura flexible eliminando espacios en blanco accidentales
    const emailInput = req.body.email || req.body.correo;
    const passwordInput = req.body.password || req.body.clave;

    // Validación estricta contra campos ausentes o strings vacíos
    if (!emailInput || !passwordInput || String(emailInput).trim() === '' || String(passwordInput).trim() === '') {
      return res.status(400).json({ error: 'Email y contraseña son requeridos.' });
    }

    const email = String(emailInput).trim().toLowerCase();
    const password = String(passwordInput);

    // Consulta adaptada a los campos reales de Azure
    const result = await pool.query(
      `SELECT id, nombre, correo, clave 
       FROM usuarios 
       WHERE LOWER(correo) = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const user = result.rows[0];

    // Verificación de contraseñas (Soporta texto plano de desarrollo y hashes bcrypt)
    let validPassword = false;
    if (password === user.clave) {
      validPassword = true;
    } else {
      try {
        validPassword = await bcrypt.compare(password, user.clave);
      } catch (e) {
        validPassword = false;
      }
    }

    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // 🏷️ Sincronización de Roles con los Middlewares (isAdmin) y las vistas del Frontend
    const userRol = user.correo.includes('admin') ? 'Administrador' : 'Cajero / Staff';

    // Generación de Token JWT con almacenamiento de carga útil completo
    const token = jwt.sign(
      { id: user.id, nombre: user.nombre, email: user.correo, correo: user.correo, rol: userRol },
      process.env.JWT_SECRET || 'secreto_temporal_cambiar',
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    // Retorno homologado para Next.js
    return res.json({
      token,
      user: { 
        id: user.id, 
        nombre: user.nombre, 
        correo: user.correo, 
        email: user.correo, 
        rol: userRol 
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/auth/me
 * Endpoint de validación de estado de sesión persistente
 */
const me = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado.' });
    }

    const result = await pool.query(
      `SELECT id, nombre, correo 
       FROM usuarios 
       WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const user = result.rows[0];
    const userRol = user.correo.includes('admin') ? 'Administrador' : 'Cajero / Staff';

    return res.json({
      id: user.id,
      nombre: user.nombre,
      correo: user.correo,
      email: user.correo,
      rol: userRol
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { login, me };