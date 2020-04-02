import express from 'express';

const usersController = require('../controllers/users-controllers');
const userRouter = express.Router();

userRouter.get('/all', usersController.getAllByUserId);

userRouter.get('/friends/:uid', usersController.getUserFriends);

userRouter.get('/', usersController.getUsers);

userRouter.get('/me', usersController.getMe);

userRouter.get('/online', usersController.getOnlineUsers);

userRouter.get('/search', usersController.searchUsers);

userRouter.get('/:pid', usersController.getUserById);

module.exports = userRouter;
