const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

// Mapear el endpoint que necesita tu frontend
router.get('/summary', reportController.getSummary);

// Los otros endpoints por si acaso los usan después
router.get('/sales-by-day', reportController.getSalesByDay);
router.get('/top-products', reportController.getTopProducts);
router.get('/sales-by-payment', reportController.getSalesByPayment);

module.exports = router;