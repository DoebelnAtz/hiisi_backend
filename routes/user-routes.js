const express = require('express');
const { check } = require('express-validator');

const usersController = require('../controllers/users-controllers');

const router = express.Router();

router.get(
    '/',
    usersController.getUsers
);

router.get(
    '/:pid',
    usersController.getUserById
);

// router.post(
//     '/signup',
//     [
//         check('username')
//             .not()
//             .isEmpty(),
//         check('password').isLength({ min: 6 })
//     ],
//     usersController.signUp
// );
//
// router.post(
//     '/login',
//     [
//         check('username')
//             .not()
//             .isEmpty(),
//         check('password')
//             .not()
//             .isEmpty(),
//     ],
//     usersController.login
// );

module.exports = router;