let jwt = require('jsonwebtoken');
const config = require('./config.js');
const accessLogger = require('./logger').accessLogger;

let checkToken = (req, res, next) => {
    let token = req.headers['x-access-token'] || req.headers['authorization'];
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
    if (token.startsWith('Bearer ')) {
        token = token.slice(7, token.length);
    }

    if (token) {
        jwt.verify(token, config.secret, (err, decoded) => {
            if (err) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid token'
                });
            } else {
                req.decoded = decoded;
                next();
            }
        });
    } else {
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
};

const logIncomingRequests = (req, res, next) => {
    if (req.method === "POST" || req.method === "PUT" ) {
        accessLogger.info(`User: ${req.decoded.username} | Method: ${req.method} | To: ${req.path} | Body: ${JSON.stringify(req.body)}`);
    }
    else if (req.method === "GET")
        accessLogger.info(`User: ${req.decoded.username} | Method: ${req.method} | To: ${req.path} | Query: ${JSON.stringify(req.query)}`);
    else {
        accessLogger.info(`User: ${req.decoded.username} | Method: ${req.method} | To: ${req.path} | Body: ${JSON.stringify(req.body)}`);
    }
    next();
};

const checkSocketToken = (socket, next) => {
    let token = socket.handshake.headers['authorization'];
    if (!token) {
        return next(new Error('authentication error'));
    }
    if (token.startsWith('Bearer ')) {
        token = token.slice(7, token.length);
    }

    if (token) {
        jwt.verify(token, config.secret, (err, decoded) => {
            if (err) {
                return next(new Error('authentication error'));
            } else {
                socket.body = {decoded: decoded};
                next();
            }
        });
    } else {
        return next(new Error('authentication error'));
    }
};


module.exports = {
    checkToken: checkToken,
    logRequests: logIncomingRequests,
    checkSocketToken: checkSocketToken
};