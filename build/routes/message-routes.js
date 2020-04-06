"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_validator_1 = require("express-validator");
const express_1 = __importDefault(require("express"));
const messageRouter = express_1.default.Router();
const messageController = require('../controllers/message-controllers');
messageRouter.get('/threads/:tid', messageController.getMessagesByThreadId);
messageRouter.get('/threads', messageController.getThreadsByUserId);
messageRouter.get('/threads/:tid/users', messageController.getUsersInThread);
messageRouter.post('/threads/create_thread', [
    express_validator_1.check('threadName')
        .not()
        .isEmpty(),
], messageController.createNewThread);
messageRouter.post('/threads/add_user', [
    express_validator_1.check('targetId')
        .not()
        .isEmpty()
        .isNumeric(),
    express_validator_1.check('threadId')
        .not()
        .isEmpty()
        .isNumeric(),
], messageController.addUserToThread);
messageRouter.delete('/threads/delete_thread', [
    express_validator_1.check('targetId')
        .not()
        .isEmpty()
        .isNumeric(),
], messageController.deleteThread);
module.exports = messageRouter;
//# sourceMappingURL=message-routes.js.map