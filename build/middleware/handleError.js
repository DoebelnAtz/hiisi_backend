"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../logger");
exports.handleError = (error, req, res, next) => {
    logger_1.errorLogger.error(`${error.status}: ${error.description} | code: ${error.code}`);
    return res.status(error.status).json({ error: error.response });
};
//# sourceMappingURL=handleError.js.map