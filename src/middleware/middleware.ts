import { NextFunction, RequestHandler } from 'express';
import { JsonWebTokenError } from 'jsonwebtoken';

let jwt = require('jsonwebtoken');
const config = require('../config.js');
const accessLogger = require('../logger').accessLogger;

let checkToken: RequestHandler = (req, res, next) => {
	let token =
		(req.headers['x-access-token'] as string) ||
		(req.headers['authorization'] as string);
	if (!token) {
		return res.status(401).json({
			success: false,
			message: 'Invalid token',
		});
	}
	if (token.startsWith('Bearer ')) {
		token = token.slice(7, token.length);
	}

	if (token) {
		jwt.verify(
			token,
			config.secret,
			(err: JsonWebTokenError, decoded: Decoded) => {
				if (err) {
					return res.status(401).json({
						success: false,
						message: 'Invalid token',
					});
				} else {
					req.decoded = decoded;
					next();
				}
			},
		);
	} else {
		return res.status(401).json({
			success: false,
			message: 'Invalid token',
		});
	}
};

const logIncomingRequests: RequestHandler = (req, res, next) => {
	if (req.method === 'GET')
		accessLogger.info(
			`User: ${req.decoded && req.decoded.username} | Method: ${
				req.method
			} | To: ${req.path} | Query: ${JSON.stringify(req.query)}`,
		);
	else {
		accessLogger.info(
			`User: ${req.decoded && req.decoded.username} | Method: ${
				req.method
			} | To: ${req.path} | Body: ${JSON.stringify(req.body)}`,
		);
	}
	next();
};

const checkSocketToken = (socket: any, next: NextFunction) => {
	let token = socket.handshake.headers['authorization'];
	if (!token) {
		return next(new Error('authentication error'));
	}
	if (token.startsWith('Bearer ')) {
		token = token.slice(7, token.length);
	}

	if (token) {
		jwt.verify(
			token,
			config.secret,
			(err: JsonWebTokenError, decoded: Decoded) => {
				if (err) {
					return next(new Error('authentication error'));
				} else {
					socket.body = { decoded: decoded };
					next();
				}
			},
		);
	} else {
		return next(new Error('authentication error'));
	}
};

module.exports = {
	checkToken: checkToken,
	logRequests: logIncomingRequests,
	checkSocketToken: checkSocketToken,
};
