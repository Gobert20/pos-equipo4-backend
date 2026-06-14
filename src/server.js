// 🔑 Cargamos las variables de entorno al inicio
require('dotenv').config();

const app = require('./app');
const port = process.env.PORT || 3000;

// Escuchamos directamente en un solo hilo para ver logs limpios en consola
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 SERVIDOR EN MODO DIRECTO ACTIVO corriendo en: http://localhost:${port}`);
});