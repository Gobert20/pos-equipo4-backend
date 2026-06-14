// 🛠️ 3. INTERCEPTOR ULTRA-COMPATIBLE DE FLUJO (¡ZONA DE RESCATE CORREGIDA!)
const userController = require('./controllers/userController');
const authController = require('./controllers/authController');
const categoryController = require('./controllers/categoryController');
const clientController = require('./controllers/clientController');
const productController = require('./controllers/productController'); 
const saleController = require('./controllers/saleController'); 
// Controlador de reportes integrado de forma directa
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
    
    // 📊 Nombres de funciones corregidos según tu reportController real:
    if (urlLimpia === '/reports/summary' || urlLimpia === '/report/summary') {
        return reportController.summary(req, res); 
    }
    if (urlLimpia === '/reports/sales-by-day') {
        return reportController.salesByDay(req, res);
    }
    if (urlLimpia === '/reports/top-products') {
        return reportController.topProducts(req, res);
    }
    if (urlLimpia === '/reports/sales-by-payment') {
        return reportController.salesByPayment(req, res);
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