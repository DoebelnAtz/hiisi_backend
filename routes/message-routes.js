const express = require('express');
const { check } = require('express-validator');
const router = express.Router();

const messageController = require('../controllers/message-controllers');

router.get(
    '/threads/:tid',
    messageController.getMessagesByThreadId
);

router.get(
    '/users/:uid',
    messageController.getThreadsByUserId
);

module.exports = router;