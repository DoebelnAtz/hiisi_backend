const express = require('express');
const projectControllers = require('../controllers/project-controllers');
const { check } = require('express-validator');
const router = express.Router();

router.get(
    '/boards/:bid',
    projectControllers.getBoardById
);

module.exports = router;