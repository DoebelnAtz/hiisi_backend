const express = require('express');
const { check } = require('express-validator');

const usersController = require('../controllers/users-controllers');
const api = require('../scheduled-jobs/update-users');
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
    '/api',
    () => api.intraApi('/users/61979')
);

router.get(
    '/:pid',
    usersController.getUserById
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