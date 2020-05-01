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
const customError_1 = __importDefault(require("./customError"));
exports.transaction = (transaction, client, errorMessage) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield client.query('BEGIN');
        yield transaction();
        yield client.query('COMMIT');
    }
    catch (e) {
        yield client.query('ROLLBACK');
        throw new customError_1.default(errorMessage, 500, e);
    }
    finally {
        client.release();
    }
});
//# sourceMappingURL=transaction.js.map