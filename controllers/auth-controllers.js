const api = require('../scheduled-jobs/api');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const db = require('../postgres/queries');
const { errorLogger } = require('../logger');
let jwt = require('jsonwebtoken');
let config = require('../config');
const users = require('./../users');
const utils = require('../utils/utils');

const signUp = async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(401).json({
			status: 'error',
			message: 'Invalid input.',
		});
	}
	const { username, password } = req.body;
	let intraId = users.find((user) => {
		console.log(user.login, user.id);
		return user.login === username;
	}).id;

	let existingUser;
	try {
		existingUser = await db.query(
			'SELECT * FROM users WHERE username = $1',
			[username],
		);
		existingUser = existingUser.rows[0]; // can't do db.query().rows[0] directly
	} catch (e) {
		console.log(e);
		return res.status(500).json({
			status: 'error',
			message: 'Sign up failed, please try again later.',
		});
	}

	if (existingUser) {
		return res.status(401).json({
			status: 'error',
			message: 'User already exists',
		});
	}

	let hashedPassword;
	try {
		hashedPassword = await bcrypt.hash(password, 10);
	} catch (e) {
		return res.status(500).json({
			status: 'error',
			message: 'Sign up failed, please try again later.',
		});
	}

	let createdUser = {
		username,
		intraId,
		hashedPassword,
	};

	const client = await db.connect();
	try {
		await client.query('BEGIN');
		let userinfo = await api.intraApi('/users/' + intraId);
		await utils.sleep(1000);
		await client.query(
			`
            INSERT INTO users (
            username,
            password,
            intraid,
            profile_pic,
            level,
            grade,
            class_of,
            wallet,
            location,
            correction_points,
            achievement_points,
            active
            ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8,
            $9, $10, $11, $12
            )
        `,
			[
				username,
				hashedPassword,
				intraId,
				userinfo.image_url,
				userinfo.cursus_users[0].level,
				userinfo.cursus_users[0].grade,
				userinfo['staff?']
					? 'Bocal'
					: userinfo.pool_month + ' ' + userinfo.pool_year,
				userinfo.wallet,
				userinfo.location,
				userinfo.correction_point,
				utils.countAchievementPoints(userinfo.achievements),
				!!userinfo.location,
			],
		);
		await client.query('COMMIT');
	} catch (e) {
		errorLogger.error('Failed to create user: ' + e);
		await client.query('ROLLBACK');
		return res.status(500).json({
			status: 'Error',
			message: 'Failed to create user',
		});
	} finally {
		client.release();
	}
	res.status(201).json({ createdUser: createdUser });
};

const login = async (req, res, next) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(400).json({
			status: 'error',
			message: 'Log in failed, please try again.',
		});
	}

	const { username, password } = req.body;

	let existingUser;
	try {
		existingUser = await db.query(
			'SELECT username, u_id, password FROM users WHERE username = $1',
			[username.toLowerCase()],
		);
		existingUser = existingUser.rows[0];
	} catch (e) {
		console.log(e);
		return res.status(500).json({
			status: 'error',
			message: 'Log in failed, please try again later.',
		});
	}

	if (!existingUser) {
		return res.status(401).json({
			status: 'error',
			message: 'Invalid credentials, please try again.',
		});
	}

	let isValidPass = false;
	try {
		isValidPass = await bcrypt.compare(password, existingUser.password);
	} catch (e) {
		console.log(e);
		return res.status(500).json({
			status: 'error',
			message: 'Log in failed, please try again later.',
		});
	}

	if (!isValidPass) {
		return res.status(401).json({
			status: 'error',
			message: 'Invalid credentials, please try again.',
		});
	}
	let token = jwt.sign(
		{ username: username, u_id: existingUser.u_id },
		config.secret,
		{
			expiresIn: '24h', // expires in 24 hours
		},
	);

	let refreshToken = jwt.sign(
		{ username: username, u_id: existingUser.u_id },
		config.secret,
		{
			expiresIn: '4d', // expires in 4 days
		},
	);

	try {
		let user = await db.query(
			`UPDATE online_users SET last_updated = NOW() WHERE u_id = $1 RETURNING u_id`,
			[existingUser.u_id],
		);
		if (!user.rows.length) {
			try {
				await db.query(`INSERT INTO online_users VALUES ($1)`, [
					existingUser.u_id,
				]);
			} catch (e) {
				errorLogger.error(`Failed to create row for online_user: ${e}`);
				return res.status().json({
					status: 'error',
					message: 'Failed to log in',
				});
			}
		}
	} catch (e) {
		errorLogger.error(`: ${e}`);
		return res.status().json({
			status: 'error',
			message: 'Failed to log in',
		});
	}
	// return the JWT token for the future API calls
	res.json({
		success: true,
		message: 'Authentication successful!',
		token: token,
		refreshToken: refreshToken,
		user: { username: existingUser.username, u_id: existingUser.u_id },
	});
};

const changePassword = async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(422).json({
			status: 'error',
			message: 'Invalid input please try again.',
		});
	}

	const { currentPassword, username, newPassword } = req.body;

	let userToUpdate;
	try {
		userToUpdate = await db.query(
			`
            SELECT username, u_id, password FROM users WHERE username = $1
        `,
			[username],
		);
		userToUpdate = userToUpdate.rows[0];
	} catch (e) {
		errorLogger.error('Failed to change password: ' + e);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to change password',
		});
	}
	let isValidPass = false;
	try {
		isValidPass = await bcrypt.compare(
			currentPassword,
			userToUpdate.password,
		);
	} catch (e) {
		errorLogger.error(
			'Failed to change password: b-crypt comparison failed: ' + e,
		);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to change password, please try again later.',
		});
	}
	if (!isValidPass) {
		return res.status(401).json({
			status: 'error',
			message: 'Invalid credentials, please try again.',
		});
	}

	let hashedPassword;
	try {
		hashedPassword = await bcrypt.hash(newPassword, 10);
	} catch (e) {
		errorLogger.error(
			'Failed to change password: b-crypt hash failed: ' + e,
		);

		return res.status(500).json({
			status: 'error',
			message: 'Failed to change password, please try again later.',
		});
	}
	const client = await db.connect();

	try {
		await client.query('BEGIN');
		await client.query(
			`
            UPDATE users SET password = $1 WHERE username = $2
        `,
			[hashedPassword, username],
		);
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		errorLogger.error(': ' + e);
		return res.status().json({
			success: false,
			status: 'error',
			message: '.',
		});
	} finally {
		client.release();
	}
	res.json({ success: true });
};

const refreshToken = async (req, res) => {
	let refreshToken = req.headers['x-refresh-token'];
	if (!refreshToken) {
		return res.status(401).json({
			success: false,
			message: 'Invalid refresh token',
		});
	}
	if (refreshToken.startsWith('Bearer ')) {
		refreshToken = refreshToken.slice(7, refreshToken.length);
	}

	if (refreshToken) {
		jwt.verify(refreshToken, config.secret, (err, decoded) => {
			if (err) {
				return res.status(401).json({
					success: false,
					message: 'Invalid refresh token',
				});
			} else {
				let token = jwt.sign(
					{ username: decoded.username, u_id: decoded.u_id },
					config.secret,
					{
						expiresIn: '24h', // expires in 24 hours
					},
				);

				let refreshToken = jwt.sign(
					{ username: decoded.username, u_id: decoded.u_id },
					config.secret,
					{
						expiresIn: '4d', // expires in 4 days
					},
				);
				return res.json({
					token,
					refreshToken,
					user: { username: decoded.username, u_id: decoded.u_id },
				});
			}
		});
	} else {
		return res.status(401).json({
			success: false,
			message: 'Invalid refresh token',
		});
	}
};

module.exports = {
	refreshToken,
	signUp,
	login,
	changePassword,
};
