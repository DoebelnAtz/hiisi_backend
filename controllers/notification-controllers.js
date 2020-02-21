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

const CreateNotification = async (req,res) => {
    const { message, type, userId, link } = req.body;

    const createdNotification = new Notification({
        type: type,
        date: new Date().toISOString(),
        u_id: userId,
        message: message,
        link: link,
        read: false
    });

    try {
        await createdNotification.save()
    } catch (e) {
        errorLogger.error('Failed to create notification: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to create notification'
        })
    }
    res.status(201).json({success: true})
};

const getUserNotifications = async (req, res) => {
    const userId = req.params.uid;

    let userNotifications;
    try {
        userNotifications = await Notification.find({u_id: userId})
    } catch (e) {
        errorLogger.error('Failed to find notificaitons matching user: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to find notificaitons matching user'
        })
    }
    res.json(userNotifications.map(user => user.toObject({getters: true})));
};

const readNotification = async (req, res) => {
    const notificationId = req.body.notificationId;
    console.log(req.body);
    let notification;
    try {
        notification = await Notification.findById(notificationId);
    } catch (e) {
        errorLogger.error('Failed to find notfication to update: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to find notfication to update'
        })
    }
    if (!notification) {
        errorLogger.error('Failed to find notification to update');
        return res.status(404).json({
            status: 'error',
            message: 'Failed to find notification to update'
        })
    }
    console.log(notification, notificationId);
    notification.read = true;
    try {
        await notification.save();
    } catch (e) {
        errorLogger.error('Failed to update notification: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to update notification'
        })
    }
    res.json({success: true})
};

exports.CreateNotification = CreateNotification;
exports.getUserNotifications =getUserNotifications;
exports.readNotification = readNotification;