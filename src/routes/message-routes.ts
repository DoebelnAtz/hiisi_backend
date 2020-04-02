import { check } from 'express-validator';
import express from 'express';
const messageRouter = express.Router();

const messageController = require('../controllers/message-controllers');
messageRouter.get('/threads/:tid', messageController.getMessagesByThreadId);

messageRouter.get('/threads', messageController.getThreadsByUserId);

messageRouter.get('/threads/:tid/users', messageController.getUsersInThread);

messageRouter.post(
	'/threads/create_thread',
	[
		check('threadName')
			.not()
			.isEmpty(),
	],
	messageController.createNewThread,
);

messageRouter.post(
	'/threads/add_user',
	[
		check('targetId')
			.not()
			.isEmpty()
			.isNumeric(),
		check('threadId')
			.not()
			.isEmpty()
			.isNumeric(),
	],
	messageController.addUserToThread,
);

messageRouter.delete(
	'/threads/delete_thread',
	[
		check('targetId')
			.not()
			.isEmpty()
			.isNumeric(),
	],
	messageController.deleteThread,
);

module.exports = messageRouter;
