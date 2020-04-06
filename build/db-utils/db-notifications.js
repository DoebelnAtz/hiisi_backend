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
const logger_1 = require("../logger");
const mongoose = require('mongoose');
const database = `mongodb+srv://aadlercr:94502491Hive@hivemind-fyteo.mongodb.net/hivemind?retryWrites=true&w=majority
`;
try {
    mongoose.connect(database, { useNewUrlParser: true });
}
catch (e) {
    logger_1.errorLogger.error('Failed to connect to mongoDB: ' + e);
}
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
const Schema = mongoose.Schema;
const NotificationSchema = new Schema({
    type: String,
    date: Date,
    u_id: Number,
    message: String,
    link: String,
    read: Boolean,
});
const NotifModel = mongoose.model('Notification', NotificationSchema);
const createNotification = (notifObj) => __awaiter(void 0, void 0, void 0, function* () {
    if (!(notifObj.type && notifObj.message && notifObj.link && notifObj.userId))
        throw new Error('Invalid input');
    const createdNotification = new NotifModel({
        type: notifObj.type,
        date: new Date().toISOString(),
        u_id: notifObj.userId,
        message: notifObj.message,
        link: notifObj.link,
        read: false,
    });
    try {
        yield createdNotification.save();
    }
    catch (e) {
        throw new Error('Failed to update notification');
    }
    return createdNotification;
});
const getUserNotifications = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    let userNotifications;
    try {
        userNotifications = yield NotifModel.find({ u_id: userId })
            .sort({ date: -1 })
            .limit(10);
    }
    catch (e) {
        throw new Error('Failed to create notification');
    }
    return userNotifications;
});
const readNotif = (notificationId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield NotifModel.update({ id: notificationId }, { $set: { read: true } }, { multi: true });
    }
    catch (e) {
        throw new Error('Failed to update notification');
    }
    return { success: true };
});
exports.createNotification = createNotification;
exports.getUserNotifications = getUserNotifications;
exports.readNotif = readNotif;
//# sourceMappingURL=db-notifications.js.map