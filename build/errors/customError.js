"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class CustomError extends Error {
    constructor(response = 'Internal server error', status = 500, description = '', code = 42) {
        super();
        this.response = response;
        this.status = status;
        this.description = description;
        this.code = code;
    }
}
exports.default = CustomError;
//# sourceMappingURL=customError.js.map