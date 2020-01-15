let jwt = require('jsonwebtoken');
const config = require('./config.js');
const logger = require('./logger');

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
                console.log(decoded);
                next();
            }
        });
    } else {
        return res.json({
            success: false,
            message: 'Invalid token'
        });
    }
};

let logIncomingRequests = (req, res, next) => {
    if (req.method === "POST") {
        logger.info(req.method + ": " + req.path + " Body: " + JSON.stringify(req.body));
    }
    else if (req.method === "GET")
        logger.info(req.method + ": " + req.path);
    next();
};


module.exports = {
    checkToken: checkToken,
    logRequests: logIncomingRequests
};