const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

// Endpoints enlazados al controlador híbrido seguro
router.get('/', clientController.getAll);
router.post('/', clientController.create);
router.delete('/:id', clientController.remove);

module.exports = router;