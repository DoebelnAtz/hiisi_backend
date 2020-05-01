"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const searchControllers = require('../controllers/search-controllers');
const searchRouter = express_1.default.Router();
searchRouter.get('/', searchControllers.searchAll);
module.exports = searchRouter;
//# sourceMappingURL=search-routes.js.map