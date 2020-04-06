"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_validator_1 = require("express-validator");
const customError_1 = __importDefault(require("./customError"));
exports.catchErrors = (requestHandler, errorMessage = 'Error') => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const errors = express_validator_1.validationResult(req);
        if (!errors.isEmpty()) {
            return next(new customError_1.default(`${errorMessage}: invalid input`, 422, 'Invalid input'));
        }
        try {
            return yield requestHandler(req, res, next);
        }
        catch (error) {
            next(new customError_1.default(((_a = error.response) === null || _a === void 0 ? void 0 : _a.length) ? error.response : errorMessage, error.status || 500, error.description || error, error.code));
        }
    });
};
//# sourceMappingURL=catchErrors.js.map