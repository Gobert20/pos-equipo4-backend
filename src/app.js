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

// 📊 OBSERVABILIDAD: Logger estructurado profesional
app.use(pinoHttp());

// 🧱 1. CONFIGURACIÓN DE CORS
app.use(cors({
    origin: 'http://localhost:3001',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Permitir JSON grandes (Base64) antes de procesar cualquier ruta
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 🛡️ 2. SEGURIDAD: Control de abusos DoS por IP
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 150, 
    message: { error: 'Demasiadas peticiones desde esta IP. Por favor intente más tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// 🛠️ 3. INTERCEPTOR ULTRA-COMPATIBLE DE FLUJO (¡ZONA DE RESCATE!)
const userController = require('./controllers/userController');
const authController = require('./controllers/authController');
const categoryController = require('./controllers/categoryController');
const clientController = require('./controllers/clientController');
const productController = require('./controllers/productController'); 
const saleController = require('./controllers/saleController'); 

app.use((req, res, next) => {
    // Normalizamos la URL removiendo parámetros query y quitando el prefijo /api si viene incluido
    let urlLimpia = req.url.split('?')[0]; 
    if (urlLimpia.startsWith('/api')) {
        urlLimpia = urlLimpia.replace('/api', '');
    }
    
    // Fallbacks de rescate para Usuarios
    if (urlLimpia === '/users' || urlLimpia === '/users/data' || urlLimpia === '/api/users-mock') {
        return userController.getAll(req, res);
    }
    // Fallbacks de rescate para Autenticación
    if (urlLimpia === '/auth/login' || urlLimpia === '/login') {
        return authController.login(req, res);
    }
    if (urlLimpia === '/auth/me' || urlLimpia === '/me') {
        return authController.me(req, res);
    }
    // Fallbacks de rescate para Categorías
    if (urlLimpia === '/categories' || urlLimpia === '/category') {
        return categoryController.getAll(req, res);
    }
    // Fallbacks de rescate para Clientes
    if (urlLimpia === '/clients' || urlLimpia === '/client') {
        return clientController.getAll(req, res);
    }
    // Fallbacks de rescate para Productos / Inventario Cloud
    if (urlLimpia === '/products' || urlLimpia === '/product') {
        return productController.getAll(req, res);
    }
    
    // 🛒 FALLBACK DE RESCATE: Captura de Ventas del POS e Historial General
    if (urlLimpia === '/sales' || urlLimpia === '/sale') {
        if (req.method === 'POST') {
            return saleController.registrarVentaReal(req, res);
        }
        return saleController.getAllSales(req, res);
    }
    
    if (urlLimpia === '/sales/historial') {
        return saleController.getAllSales(req, res);
    }

    // ⚡ FALLBACK DE RESCATE: Desglose dinámico (ej: /sales/3 o /api/sales/3)
    const partesUrl = urlLimpia.split('/'); 
    if (partesUrl[1] === 'sales' && partesUrl[2] && !isNaN(partesUrl[2])) {
        req.params = { id: partesUrl[2] }; 
        return saleController.getSaleDetails(req, res);
    }

    next();
});

// 🩺 4. ENDPOINT: Health Check
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
            "/api/users"       
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