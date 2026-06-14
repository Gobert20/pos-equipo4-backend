const { Pool } = require('pg');
const path = require('path');

const dotenvPath = path.resolve(__dirname, '..', '..', '.env');
require('dotenv').config({ path: dotenvPath });

console.log('🔑 Intentando conectar a Azure con el usuario:', process.env.DB_USER);

// Evaluamos el host: Si NO es localhost ni 127.0.0.1, asumimos que es Azure/Nube y FORZAMOS SSL.
const hostActual = process.env.DB_HOST || '';
const necesitaSSL = !(hostActual.includes('localhost') || hostActual.includes('127.0.0.1'));

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: necesitaSSL ? { rejectUnauthorized: false } : false
});

// Listener cuando una conexión se establece con éxito
pool.on('connect', () => {
    console.log('📡 Conexión exitosa con Azure PostgreSQL Cluster.');
});

// 🔄 SOLUCIÓN A LIMITACIÓN CLOUD: Manejo de errores inesperados en clientes inactivos
// Evita que el proceso Node.js muera (crash) si Azure PostgreSQL parpadea o se reinicia.
pool.on('error', (err, client) => {
    console.error('⚠️ Error inesperado en un cliente inactivo del Pool de PostgreSQL:', err.message);
    // No matamos el proceso (process.exit), dejamos que el Pool cree nuevos clientes en la siguiente consulta
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};