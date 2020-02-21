const express = require('express');
const { check } = require('express-validator');
const router = express.Router();

const notificationController = require('../controllers/notification-controllers');

router.get(
    '/users/:uid',
    notificationController.getUserNotifications
);

router.post(
    '/create_notification',
    notificationController.CreateNotification
);

router.put(
    '/read_notification',
    notificationController.readNotification
);

module.exports = router;
