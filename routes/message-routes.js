const express = require('express');
const { check } = require('express-validator');
const router = express.Router();

const messageController = require('../controllers/message-controllers');
const chatController = require('../controllers/chat-controllers');

router.get('/threads/:tid', messageController.getMessagesByThreadId);

router.get('/threads', messageController.getThreadsByUserId);

router.get('/threads/:tid/users', messageController.getUsersInThread);

router.post(
	'/threads/create_thread',
	[
		check('threadName')
			.not()
			.isEmpty(),
	],
	messageController.createNewThread,
);

router.post(
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

router.delete(
	'/threads/delete_thread',
	[
		check('targetId')
			.not()
			.isEmpty()
			.isNumeric(),
	],
	messageController.deleteThread
);

module.exports = router;
