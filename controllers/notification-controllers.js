const dbNotifications = require('../db-utils/db-notifications');
const {errorLogger} =  require('../logger');

const CreateNotification = async (req,res) => {
    const { message, type, userId, link } = req.body;
    console.log(req.body);
    let createdNotification = {
        type: type,
        userId: userId,
        message: message,
        link: link,
    };
    console.log(createdNotification);
    try {
        await dbNotifications.createNotification(createdNotification)
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
        userNotifications = await dbNotifications.getUserNotifications(userId)
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
        notification = await dbNotifications.readNotification(notificationId);
    } catch (e) {
        errorLogger.error('Failed to find notfication to update: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to find notfication to update'
        })
    }
    res.json({success: true})
};

exports.CreateNotification = CreateNotification;
exports.getUserNotifications =getUserNotifications;
exports.readNotification = readNotification;