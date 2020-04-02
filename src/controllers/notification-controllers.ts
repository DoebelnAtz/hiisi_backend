import { catchErrors } from '../errors/catchErrors';

const dbNotifications = require('../db-utils/db-notifications');

export const createNotification = catchErrors(async (req, res) => {
	const { message, type, userId, link } = req.body;
	let createdNotification = {
		type: type,
		userId: userId,
		message: message,
		link: link,
	};
	console.log(createdNotification);

	await dbNotifications.createNotification(createdNotification);
	res.status(201).json({ success: true });
}, 'Failed to creaete notification');

export const getUserNotifications = catchErrors(async (req, res) => {
	const userId = req.params.uid;

	let userNotifications = await dbNotifications.getUserNotifications(userId);

	res.json(
		userNotifications.map((notif: any) =>
			notif.toObject({ getters: true }),
		),
	);
}, 'Failed to get user notifications');

export const readNotification = catchErrors(async (req, res) => {
	const notificationId = req.body.notificationId;

	await dbNotifications.readNotif(notificationId);

	res.json({ success: true });
}, 'Failed to update notification');
