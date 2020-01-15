const express = require('express');
const { check } = require('express-validator');
const router = express.Router();

const messageController = require('../controllers/message-controllers');
const chatController = require('../controllers/chat-controllers');

router.get(
    '/threads/:tid',
    messageController.getMessagesByThreadId
);

router.get(
    '/users/:uid',
    messageController.getThreadsByUserId
);

// router.post(
//     '/threads/:tid',
//     chatController.saveMessageToDB
// );

module.exports = router;