const express = require('express');
const { check } = require('express-validator');
const authRouter = express.Router();
const authController = require('../controllers/auth-controllers');

authRouter.post(
	'/signup',
	[
		check('username')
			.not()
			.isEmpty(),
		check('password').isLength({ min: 8 }),
	],
	authController.signUp,
);

authRouter.put(
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
	authController.changePassword,
);

authRouter.post(
	'/login',
	[
		check('username')
			.not()
			.isEmpty(),
		check('password')
			.not()
			.isEmpty(),
	],
	authController.login,
);

authRouter.post('/refresh_token', authController.refreshToken);

module.exports = authRouter;
