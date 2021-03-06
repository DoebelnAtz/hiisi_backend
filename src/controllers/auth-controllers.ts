import { catchErrors } from '../errors/catchErrors';
import CustomError from '../errors/customError';
import { JsonWebTokenError } from 'jsonwebtoken';

const api = require('../scheduled-jobs/api');
const bcrypt = require('bcryptjs');
import db from '../postgres/queries';
import { accessLogger } from '../logger';
const { errorLogger } = require('../logger');
let jwt = require('jsonwebtoken');
let config = require('../config');
const users = require('../../users');
const utils = require('../utils/utils');

const signUp = catchErrors(async (req, res) => {
	const { username, password } = req.body;
	let intraId = users.find((user: { login: string; id: number }) => {
		return user.login === username;
	});

	if (!(intraId = intraId?.id)) {
		throw new CustomError(
			'Unrecognized username',
			403,
			`Failed to sign up: unrecognized username`,
		);
	}

	let existingUser = await db.query(
		'SELECT * FROM users WHERE username = $1',
		[username],
	);

	existingUser = existingUser.rows[0]; // can't do db.query().rows[0] directly

	if (existingUser) {
		throw new CustomError(
			'User already exists',
			401,
			`Failed to sign up: user ${username} already exists`,
		);
	}

	let hashedPassword;

	hashedPassword = await bcrypt.hash(password, 10);

	const client = await db.connect();
	let createdUser;
	// Here we catch any errors separately to make sure we rollback changes
	try {
		await client.query('BEGIN');
		let userinfo = await api.intraApi('/users/' + intraId);
		await utils.sleep(1000);
		createdUser = await client.query(
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
		) RETURNING username
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
		await client.query('ROLLBACK');
		throw new CustomError(
			'Failed to create user',
			500,
			'Failed to create user: ' + e,
		);
	} finally {
		client.release();
	}
	// @ts-ignore
	accessLogger.info(`Created user: ${createdUser.username}`);
	res.status(201).json({ createdUser: createdUser });
}, 'Failed to create user');

const login = catchErrors(async (req, res, next) => {
	const { username, password } = req.body;

	let existingUser;

	existingUser = await db.query(
		'SELECT username, u_id, password FROM users WHERE username = $1',
		[username.toLowerCase()],
	);
	existingUser = existingUser.rows[0];

	// Even though this seems like a 404 error we don't want to return information
	// on whether or not a user exists
	if (!existingUser) {
		throw new CustomError(
			`Failed to log in: invalid credentials`,
			401,
			`Failed to log in did not find user: ${username}`,
		);
	}
	let isValidPass = false;
	try {
		isValidPass = await bcrypt.compare(password, existingUser.password);
	} catch (e) {
		throw new CustomError(
			`Failed to log in`,
			500,
			`Bcrypt failed to compare passwords`,
		);
	}

	if (!isValidPass) {
		throw new CustomError(
			`Failed to log in: invalid credentials`,
			401,
			`Invalid credentials`,
		);
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
		config.refreshSecret,
		{
			expiresIn: '4d', // expires in 4 days
		},
	);
	const client = await db.connect();
	try {
		await client.query('BEGIN');
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
				return res.status(500).json({
					status: 'error',
					message: 'Failed to log in',
				});
			}
		}
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		throw new CustomError(
			`Failed to log in`,
			500,
			`Failed to log in: ${e}`,
		);
	} finally {
		client.release();
	}
	accessLogger.info(`Logged in user: ${username}`);
	// return the JWT token for the future API calls
	res.json({
		success: true,
		message: 'Authentication successful!',
		token: token,
		refreshToken: refreshToken,
		user: { username: existingUser.username, u_id: existingUser.u_id },
	});
}, 'Failed to log in');

const changePassword = catchErrors(async (req, res) => {
	const { currentPassword, username, newPassword } = req.body;

	let userToUpdate;

	userToUpdate = await db.query(
		`
		SELECT username, u_id, password FROM users WHERE username = $1
	`,
		[username],
	);
	userToUpdate = userToUpdate.rows[0];

	let isValidPass = await bcrypt.compare(
		currentPassword,
		userToUpdate.password,
	);

	if (!isValidPass) {
		throw new CustomError('Invalid credentials', 401);
	}

	let hashedPassword;

	hashedPassword = await bcrypt.hash(newPassword, 10);

	const client = await db.connect();

	try {
		await client.query('BEGIN');
		await client.query(
			`UPDATE users SET password = $1 WHERE username = $2`,
			[hashedPassword, username],
		);
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		errorLogger.error('Failed to change password: ' + e);
		return res.status(500).json({
			success: false,
			status: 'error',
			message: 'Failed to change password.',
		});
	} finally {
		client.release();
	}
	res.json({ success: true });
}, 'Failed to change password');

const refreshToken = catchErrors(async (req, res) => {
	let refreshToken = req.headers['x-refresh-token'] as string;
	if (!refreshToken) {
		throw new CustomError(
			'Failed to refresh token',
			401,
			'Failed to find refresh token header',
		);
	}
	if (refreshToken.startsWith('Bearer ')) {
		refreshToken = refreshToken.slice(7, refreshToken.length);
	}

	if (refreshToken) {
		jwt.verify(
			refreshToken,
			config.refreshSecret,
			(err: JsonWebTokenError, decoded: any) => {
				if (err) {
					throw new CustomError(
						'Failed to refresh token',
						401,
						'Failed to verify refresh token',
					);
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
						config.refreshSecret,
						{
							expiresIn: '4d', // expires in 4 days
						},
					);
					return res.json({
						token,
						refreshToken,
						user: {
							username: decoded.username,
							u_id: decoded.u_id,
						},
					});
				}
			},
		);
	} else {
		throw new CustomError('Failed to refresh token', 401);
	}
}, 'Failed to refresh access token');

module.exports = {
	refreshToken,
	signUp,
	login,
	changePassword,
};
