"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { createLogger, transports, format } = require('winston');
exports.accessLogger = createLogger({
    format: format.combine(format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }), format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)),
    transports: [
        new transports.File({
            filename: './logs/access.log',
            json: false,
            maxsize: 2000000,
            maxFiles: 5,
        }),
        new transports.Console(),
    ],
});
exports.errorLogger = createLogger({
    format: format.combine(format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }), format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)),
    transports: [
        new transports.File({
            filename: './logs/error.log',
            json: false,
            maxsize: 20000000,
            maxFiles: 5,
        }),
        new transports.Console(),
    ],
});
//# sourceMappingURL=index.js.map