const express = require('express');
const { check } = require('express-validator');

const usersController = require('../controllers/users-controllers');

const router = express.Router();

router.get(
    '/friends/:uid',
    usersController.getUserFriends
);

router.get(
    '/',
    usersController.getUsers
);

router.get(
    '/:pid',
    usersController.getUserById
);

router.post(
    '/signup',
    [
        check('username')
            .not()
            .isEmpty(),
        check('intraId')
            .not()
            .isEmpty(),
        check('password').isLength({ min: 6 })
    ],
    usersController.signUp
);

router.post(
    '/login',
    [
        check('username')
            .not()
            .isEmpty(),
        check('password')
            .not()
            .isEmpty(),
    ],
    usersController.login
);

router.post(
    '/search',
    [
        check('search')
            .not()
            .isEmpty(),
    ],
    usersController.searchUsers
);

module.exports = router;