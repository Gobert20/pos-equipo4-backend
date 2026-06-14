const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');

// POST /api/sales -> Registrar venta desde el POS
router.post('/', saleController.registrarVentaReal);

// GET /api/sales -> Cargar historial general
router.get('/', saleController.getAllSales);
router.get('/historial', saleController.getAllSales);

// GET /api/sales/:id -> Cargar desglose de artículos de una boleta al hacer clic
router.get('/:id', saleController.getSaleDetails);
router.get('/detalle/:id', saleController.getSaleDetails);

module.exports = router;