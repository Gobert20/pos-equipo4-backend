const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// 🔓 COMENTADO TEMPORALMENTE: Permite que Next.js lea la tabla de Azure libremente para la prueba
router.get('/', userController.getAll);

// 🛡️ Estos se quedan protegidos para que nadie manipule la BD sin ser Admin
router.post('/', verifyToken, isAdmin, userController.create);
router.put('/:id', verifyToken, isAdmin, userController.update);
router.delete('/:id', verifyToken, isAdmin, userController.remove);

module.exports = router;