"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const usersController = require('../controllers/users-controllers');
const userRouter = express_1.default.Router();
userRouter.get('/all', usersController.getAllByUserId);
userRouter.get('/friends/:uid', usersController.getUserFriends);
userRouter.get('/', usersController.getUsers);
userRouter.get('/me', usersController.getMe);
userRouter.get('/online', usersController.getOnlineUsers);
userRouter.get('/search', usersController.searchUsers);
userRouter.get('/:pid', usersController.getUserById);
module.exports = userRouter;
//# sourceMappingURL=user-routes.js.map