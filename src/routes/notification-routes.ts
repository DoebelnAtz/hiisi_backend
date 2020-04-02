import express from 'express';
const notificationRouter = express.Router();

const notificationController = require('../controllers/notification-controllers');

notificationRouter.get(
	'/users/:uid',
	notificationController.getUserNotifications,
);

notificationRouter.post(
	'/create_notification',
	notificationController.createNotification,
);

notificationRouter.put(
	'/read_notification',
	notificationController.readNotification,
);

module.exports = notificationRouter;
