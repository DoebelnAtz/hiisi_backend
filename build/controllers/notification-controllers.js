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
Object.defineProperty(exports, "__esModule", { value: true });
const catchErrors_1 = require("../errors/catchErrors");
const dbNotifications = require('../db-utils/db-notifications');
exports.createNotification = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { message, type, userId, link } = req.body;
    let createdNotification = {
        type: type,
        userId: userId,
        message: message,
        link: link,
    };
    console.log(createdNotification);
    yield dbNotifications.createNotification(createdNotification);
    res.status(201).json({ success: true });
}), 'Failed to creaete notification');
exports.getUserNotifications = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.params.uid;
    let userNotifications = yield dbNotifications.getUserNotifications(userId);
    res.json(userNotifications.map((notif) => notif.toObject({ getters: true })));
}), 'Failed to get user notifications');
exports.readNotification = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const notificationId = req.body.notificationId;
    yield dbNotifications.readNotif(notificationId);
    res.json({ success: true });
}), 'Failed to update notification');
//# sourceMappingURL=notification-controllers.js.map