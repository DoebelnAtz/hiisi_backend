const express = require('express');
const projectControllers = require('../controllers/project-controllers');
const { check } = require('express-validator');
const router = express.Router();

router.post(
    '/boards/add_task',
    [
        check('taskTitle')
            .not()
            .isEmpty(),
        check('taskColumnId')
            .not()
            .isEmpty(),
    ],
    projectControllers.addTaskToBoard
);

router.get(
    '/boards/:bid',
    projectControllers.getBoardById
);

router.post(
    '/boards/save_board',
    projectControllers.saveBoardState
);

module.exports = router;