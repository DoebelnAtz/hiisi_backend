const express = require('express');
const authController = require('../controllers/auth-controllers');
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
    authController.signUp
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
    authController.changePassword
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
    authController.login
);

router.post(
    '/refresh_token',
    authController.refreshToken
);

module.exports = router;