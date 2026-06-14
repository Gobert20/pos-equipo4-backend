const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Middleware para capturar errores de validación de campos
const validarCampos = (req, res, next) => {
    const errores = validationResult(req);
    if (!errores.isEmpty()) {
        return res.status(400).json({ 
            status: 'ERROR',
            errors: errores.array().map(err => ({ campo: err.path, mensaje: err.msg })) 
        });
    }
    next();
};

// POST: /api/auth/login
router.post('/login', 
    // 🔄 1. Middleware de Normalización Híbrida:
    // Duplica los campos para asegurar que existan tanto en inglés como en español
    (req, res, next) => {
        if (req.body.correo && !req.body.email) req.body.email = req.body.correo;
        if (req.body.email && !req.body.correo) req.body.correo = req.body.email;
        
        if (req.body.clave && !req.body.password) req.body.password = req.body.clave;
        if (req.body.password && !req.body.clave) req.body.clave = req.body.password;
        next();
    },
    // 🔍 2. Validaciones Limpias de Express Validator (ahora que los campos están normalizados)
    [
        body('email')
            .notEmpty().withMessage('El correo electrónico es obligatorio.')
            .isEmail().withMessage('Debe proporcionar un correo electrónico con formato válido.'),
        body('password')
            .notEmpty().withMessage('La contraseña es obligatoria.')
            .isLength({ min: 4 }).withMessage('La contraseña debe tener al menos 4 caracteres.'),
        validarCampos
    ], 
    // 🚀 3. Controlador final
    authController.login
);

// GET: /api/auth/me (Verificación de estado de sesión persistente)
router.get('/me', verifyToken, authController.me);

module.exports = router;