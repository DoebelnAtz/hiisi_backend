const express = require('express');
const usersController = require('../controllers/users-controllers');
const { check } = require('express-validator');
const router = express.Router();

router.post(
    '/signup',
    [
        check('username')
            .not()
            .isEmpty(),
        check('password').isLength({ min: 8 })
    ],
    usersController.signUp
);

router.put(
    '/change_password',
    [
        check('username')
            .not()
            .isEmpty(),
        check('currentPassword')
            .not()
            .isEmpty()
            .isString(),
        check('newPassword')
            .not()
            .isEmpty()
            .isString()
            .isLength({ min: 8 }),
    ],
    usersController.changePassword
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

module.exports = router;