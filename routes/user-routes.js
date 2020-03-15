const express = require('express');
const { check } = require('express-validator');

const usersController = require('../controllers/users-controllers');
const api = require('../scheduled-jobs/update-users');
const router = express.Router();


router.get(
    '/all',
    usersController.getAllByUserId
);

router.get(
    '/friends/:uid',
    usersController.getUserFriends
);

router.get(
    '/',
    usersController.getUsers
);

router.get(
    '/me',
    usersController.getMe
);

router.get(
    '/online',
    usersController.getOnlineUsers
);

router.get(
    '/search',
    usersController.searchUsers
);



router.get(
    '/:pid',
    usersController.getUserById
);



module.exports = router;
