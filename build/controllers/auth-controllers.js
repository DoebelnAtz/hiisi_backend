"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const catchErrors_1 = require("../errors/catchErrors");
const customError_1 = __importDefault(require("../errors/customError"));
const api = require('../scheduled-jobs/api');
const bcrypt = require('bcryptjs');
const queries_1 = __importDefault(require("../postgres/queries"));
const logger_1 = require("../logger");
const { errorLogger } = require('../logger');
let jwt = require('jsonwebtoken');
let config = require('../config');
const users = require('../../users');
const utils = require('../utils/utils');
const signUp = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    let intraId = users.find((user) => {
        return user.login === username;
    });
    if (!(intraId = intraId === null || intraId === void 0 ? void 0 : intraId.id)) {
        throw new customError_1.default('Unrecognized username', 403, `Failed to sign up: unrecognized username`);
    }
    let existingUser = yield queries_1.default.query('SELECT * FROM users WHERE username = $1', [username]);
    existingUser = existingUser.rows[0];
    if (existingUser) {
        throw new customError_1.default('User already exists', 401, `Failed to sign up: user ${username} already exists`);
    }
    let hashedPassword;
    hashedPassword = yield bcrypt.hash(password, 10);
    const client = yield queries_1.default.connect();
    let createdUser;
    try {
        yield client.query('BEGIN');
        let userinfo = yield api.intraApi('/users/' + intraId);
        yield utils.sleep(1000);
        createdUser = yield client.query(`
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
	`, [
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
        ]);
        yield client.query('COMMIT');
    }
    catch (e) {
        yield client.query('ROLLBACK');
        throw new customError_1.default('Failed to create user', 500, 'Failed to create user: ' + e);
    }
    finally {
        client.release();
    }
    logger_1.accessLogger.info(`Created user: ${createdUser.username}`);
    res.status(201).json({ createdUser: createdUser });
}), 'Failed to create user');
const login = catchErrors_1.catchErrors((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    let existingUser;
    existingUser = yield queries_1.default.query('SELECT username, u_id, password FROM users WHERE username = $1', [username.toLowerCase()]);
    existingUser = existingUser.rows[0];
    if (!existingUser) {
        throw new customError_1.default(`Failed to log in: invalid credentials`, 401, `Failed to log in did not find user: ${username}`);
    }
    let isValidPass = false;
    try {
        isValidPass = yield bcrypt.compare(password, existingUser.password);
    }
    catch (e) {
        throw new customError_1.default(`Failed to log in`, 500, `Bcrypt failed to compare passwords`);
    }
    if (!isValidPass) {
        throw new customError_1.default(`Failed to log in: invalid credentials`, 401, `Invalid credentials`);
    }
    let token = jwt.sign({ username: username, u_id: existingUser.u_id }, config.secret, {
        expiresIn: '24h',
    });
    let refreshToken = jwt.sign({ username: username, u_id: existingUser.u_id }, config.refreshSecret, {
        expiresIn: '4d',
    });
    const client = yield queries_1.default.connect();
    try {
        yield client.query('BEGIN');
        let user = yield queries_1.default.query(`UPDATE online_users SET last_updated = NOW() WHERE u_id = $1 RETURNING u_id`, [existingUser.u_id]);
        if (!user.rows.length) {
            try {
                yield queries_1.default.query(`INSERT INTO online_users VALUES ($1)`, [
                    existingUser.u_id,
                ]);
            }
            catch (e) {
                errorLogger.error(`Failed to create row for online_user: ${e}`);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to log in',
                });
            }
        }
        yield client.query('COMMIT');
    }
    catch (e) {
        yield client.query('ROLLBACK');
        throw new customError_1.default(`Failed to log in`, 500, `Failed to log in: ${e}`);
    }
    finally {
        client.release();
    }
    logger_1.accessLogger.info(`Logged in user: ${username}`);
    res.json({
        success: true,
        message: 'Authentication successful!',
        token: token,
        refreshToken: refreshToken,
        user: { username: existingUser.username, u_id: existingUser.u_id },
    });
}), 'Failed to log in');
const changePassword = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { currentPassword, username, newPassword } = req.body;
    let userToUpdate;
    userToUpdate = yield queries_1.default.query(`
		SELECT username, u_id, password FROM users WHERE username = $1
	`, [username]);
    userToUpdate = userToUpdate.rows[0];
    let isValidPass = yield bcrypt.compare(currentPassword, userToUpdate.password);
    if (!isValidPass) {
        throw new customError_1.default('Invalid credentials', 401);
    }
    let hashedPassword;
    hashedPassword = yield bcrypt.hash(newPassword, 10);
    const client = yield queries_1.default.connect();
    try {
        yield client.query('BEGIN');
        yield client.query(`UPDATE users SET password = $1 WHERE username = $2`, [hashedPassword, username]);
        yield client.query('COMMIT');
    }
    catch (e) {
        yield client.query('ROLLBACK');
        errorLogger.error('Failed to change password: ' + e);
        return res.status(500).json({
            success: false,
            status: 'error',
            message: 'Failed to change password.',
        });
    }
    finally {
        client.release();
    }
    res.json({ success: true });
}), 'Failed to change password');
const refreshToken = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let refreshToken = req.headers['x-refresh-token'];
    if (!refreshToken) {
        throw new customError_1.default('Failed to refresh token', 401, 'Failed to find refresh token header');
    }
    if (refreshToken.startsWith('Bearer ')) {
        refreshToken = refreshToken.slice(7, refreshToken.length);
    }
    if (refreshToken) {
        jwt.verify(refreshToken, config.refreshSecret, (err, decoded) => {
            if (err) {
                throw new customError_1.default('Failed to refresh token', 401, 'Failed to verify refresh token');
            }
            else {
                let token = jwt.sign({ username: decoded.username, u_id: decoded.u_id }, config.secret, {
                    expiresIn: '24h',
                });
                let refreshToken = jwt.sign({ username: decoded.username, u_id: decoded.u_id }, config.refreshSecret, {
                    expiresIn: '4d',
                });
                return res.json({
                    token,
                    refreshToken,
                    user: {
                        username: decoded.username,
                        u_id: decoded.u_id,
                    },
                });
            }
        });
    }
    else {
        throw new customError_1.default('Failed to refresh token', 401);
    }
}), 'Failed to refresh access token');
module.exports = {
    refreshToken,
    signUp,
    login,
    changePassword,
};
//# sourceMappingURL=auth-controllers.js.map