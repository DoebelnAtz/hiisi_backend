const {errorLogger} =  require('../logger');

const mongoose = require('mongoose');
const database = `mongodb+srv://aadlercr:94502491Hive@hivemind-fyteo.mongodb.net/hivemind?retryWrites=true&w=majority
`;

try {
    mongoose.connect(database, { useNewUrlParser: true });
} catch (e) {
    errorLogger.error('Failed to connect to mongoDB: ' + e)
}

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// Defining models here since there is only one, unnecessary to create new directories for it.

const Schema = mongoose.Schema;

const NotificationSchema = new Schema({
    type: String,
    date: Date,
    u_id: Number,
    message: String,
    link: String,
    read: Boolean
});

const Notification = mongoose.model('Notification', NotificationSchema);

const createNotification = async (notifObj) => {
    if (!(notifObj.type && notifObj.message && notifObj.link && notifObj.userId))
        throw new Error ('Invalid input');

    const createdNotification = new Notification({
        type: notifObj.type,
        date: new Date().toISOString(),
        u_id: notifObj.userId,
        message: notifObj.message,
        link: notifObj.link,
        read: false
    });

    try {
        await createdNotification.save()
    } catch (e) {
        throw new Error ('Failed to update notification')
    }
    return (createdNotification);
};

const getUserNotifications = async (userId) => {
    let userNotifications;
    try {
        userNotifications = await Notification.find({u_id: userId}).sort({'date': -1}).limit(10)
    } catch (e) {
        throw new Error ('Failed to create notification')

    }
    return(userNotifications);
};

const readNotification = async (notificationId) => {
    let notification;
    try {
        notification = await Notification.update(
            {'id': notificationId},
            {'$set': {'read': true}},
            {'multi': true});
    } catch (e) {
        throw new Error ('Failed to update notification')
    }
   return ({success: true})
};


exports.createNotification = createNotification;
exports.getUserNotifications = getUserNotifications;
exports.readNotification = readNotification;