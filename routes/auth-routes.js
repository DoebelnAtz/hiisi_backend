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

module.exports = router;