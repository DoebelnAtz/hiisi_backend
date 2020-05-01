"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const notificationRouter = express_1.default.Router();
const notificationController = require('../controllers/notification-controllers');
notificationRouter.get('/users/:uid', notificationController.getUserNotifications);
notificationRouter.post('/create_notification', notificationController.createNotification);
notificationRouter.put('/read_notification', notificationController.readNotification);
module.exports = notificationRouter;
//# sourceMappingURL=notification-routes.js.map