const router = require('express').Router();
const crypto = require('crypto');
const { evalReport } = require('../controllers/evalController');

// Clave de evaluación — conocida solo por el docente.
// Puede sobreescribirse con la variable de entorno EVAL_SECRET si se requiere
// rotar sin modificar el código.
const EVAL_KEY = process.env.EVAL_SECRET || 'Pb#Cloud2026*ipvg';

router.get('/', (req, res, next) => {
  const provided = req.headers['x-eval-key'] || req.query.key;

  // Comparación en tiempo constante para evitar timing attacks
  const aBuffer = Buffer.from(provided  || '', 'utf8');
  const bBuffer = Buffer.from(EVAL_KEY, 'utf8');
  const valid =
    aBuffer.length === bBuffer.length &&
    crypto.timingSafeEqual(aBuffer, bBuffer);

  if (!valid) {
    return res.status(404).json({ error: 'Not found.' });
  }

  next();
}, evalReport);

module.exports = router;
