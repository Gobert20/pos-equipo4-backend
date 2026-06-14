const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(403).json({ message: "Se requiere un token para la autenticación" });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
        req.user = decoded;
    } catch (err) {
        return res.status(401).json({ message: "Token inválido o expirado" });
    }
    return next();
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.rol === 'admin') {
        next();
    } else {
        return res.status(403).json({ message: "Requiere rol de Administrador" });
    }
};

module.exports = { verifyToken, isAdmin };