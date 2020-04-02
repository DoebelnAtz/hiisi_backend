import express from 'express';

const searchControllers = require('../controllers/search-controllers');

const searchRouter = express.Router();

searchRouter.get('/', searchControllers.searchAll);

module.exports = searchRouter;
