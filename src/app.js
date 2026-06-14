const express = require('express');
const cors = require('cors');
const productRoutes = require('./routes/productRoutes');
const salesRoutes = require('./routes/sales'); 
const authRoutes = require('./routes/auth'); 
const categoryRoutes = require('./routes/categories');
const clientRoutes = require('./routes/clients');
const userRoutes = require('./routes/users');

// Módulos exigidos por la pauta Cloud
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');

const app = express();

// 🚀 REQUERIDO PARA CLOUD: Confiar en el proxy de Render para leer IPs reales de usuarios
app.set('trust proxy', 1);

// 📊 OBSERVABILIDAD: Logger estructurado profesional
app.use(pinoHttp());

// 🧱 1. CONFIGURACIÓN DE CORS LIBERADA PARA PRODUCCIÓN
app.use(cors({
    origin: true, // Permite peticiones desde tu localhost y desde tu Vercel dinámicamente
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Permitir JSON grandes (Base64) antes de procesar cualquier ruta
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 🛡️ 2. SEGURIDAD: Control de abusos DoS por IP corregido para proxies externos
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 150, 
    message: { error: 'Demasiadas peticiones desde esta IP. Por favor intente más tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    keyGenerator: (req) => {
        if (req.headers['x-forwarded-for']) {
            return req.headers['x-forwarded-for'].split(',')[0].trim();
        }
        return req.ip;
    }
});
app.use('/api/', apiLimiter);

// 🛠️ 3. INTERCEPTOR ULTRA-COMPATIBLE DE FLUJO (¡ZONA DE RESCATE!)
const userController = require('./controllers/userController');
const authController = require('./controllers/authController');
const categoryController = require('./controllers/categoryController');
const clientController = require('./controllers/clientController');
const productController = require('./controllers/productController'); 
const saleController = require('./controllers/saleController'); 
// 📊 Controlador de reportes integrado de forma directa
const reportController = require('./controllers/reportController'); 

app.use((req, res, next) => {
    let urlLimpia = req.url.split('?')[0]; 
    if (urlLimpia.startsWith('/api')) {
        urlLimpia = urlLimpia.replace('/api', '');
    }
    
    if (urlLimpia === '/users' || urlLimpia === '/users/data' || urlLimpia === '/api/users-mock') {
        return userController.getAll(req, res);
    }
    if (urlLimpia === '/auth/login' || urlLimpia === '/login') {
        return authController.login(req, res);
    }
    if (urlLimpia === '/auth/me' || urlLimpia === '/me') {
        return authController.me(req, res);
    }
    if (urlLimpia === '/categories' || urlLimpia === '/category') {
        return categoryController.getAll(req, res);
    }
    if (urlLimpia === '/clients' || urlLimpia === '/client') {
        return clientController.getAll(req, res);
    }
    if (urlLimpia === '/products' || urlLimpia === '/product') {
        return productController.getAll(req, res);
    }
    
    // 📊 Rescate directo de llamadas de reportes usando el controlador existente
    if (urlLimpia === '/reports/summary' || urlLimpia === '/report/summary') {
        return reportController.getSummary(req, res);
    }
    if (urlLimpia === '/reports/sales-by-day') {
        return reportController.getSalesByDay(req, res);
    }
    if (urlLimpia === '/reports/top-products') {
        return reportController.getTopProducts(req, res);
    }
    if (urlLimpia === '/reports/sales-by-payment') {
        return reportController.getSalesByPayment(req, res);
    }
    
    if (urlLimpia === '/sales' || urlLimpia === '/sale') {
        if (req.method === 'POST') {
            return saleController.registrarVentaReal(req, res);
        }
        return saleController.getAllSales(req, res);
    }
    
    if (urlLimpia === '/sales/historial') {
        return saleController.getAllSales(req, res);
    }

    const partesUrl = urlLimpia.split('/'); 
    if (partesUrl[1] === 'sales' && partesUrl[2] && !isNaN(partesUrl[2])) {
        req.params = { id: partesUrl[2] }; 
        return saleController.getSaleDetails(req, res);
    }

    next();
});

// 🩺 4. ENDPOINT: Health Check (Protección Anti-crash)
app.get('/health', async (req, res) => {
    try {
        const db = require('./config/database');
        await db.query('SELECT 1;'); 
        res.status(200).json({
            status: 'UP',
            timestamp: new Date(),
            services: { database: 'CONNECTED', server: 'ONLINE' }
        });
    } catch (error) {
        res.status(503).json({
            status: 'DOWN',
            timestamp: new Date(),
            error: error.message
        });
    }
});

// 🔌 Enrutadores modulares estándar del Sistema POS
app.use('/api/products', productRoutes); 
app.use('/api/sales', salesRoutes);      
app.use('/api/auth', authRoutes); 
app.use('/api/categories', categoryRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/users', userRoutes);

// 🔍 Manejador global de rutas no encontradas (404)
app.use((req, res) => {
    res.status(404).json({ 
        message: "Punto final no encontrado en el clúster de Azure.",
        endpoints_validos: [
            "/health",
            "/api/products",
            "/api/sales",
            "/api/auth/login",
            "/api/categories", 
            "/api/clients",    
            "/api/users",
            "/api/reports/summary"
        ]
    });
});

// 🛡️ 5. CONTROLADOR GLOBAL DE ERRORES (ZONA ANTI-CRASH 500)
app.use((err, req, res, next) => {
    console.error("🔥 Error crítico interno no manejado:", err.stack);
    return res.status(500).json({
        error: "Ocurrió un error inesperado en el servidor Express.",
        detalle: err.message
    });
});

module.exports = app;