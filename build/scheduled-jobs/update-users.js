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
const api = require('./api');
const queries_1 = __importDefault(require("../postgres/queries"));
const logger_1 = require("../logger");
const utils = require('../utils/utils');
const updateUsers = () => __awaiter(void 0, void 0, void 0, function* () {
    let users;
    try {
        users = yield queries_1.default.query('SELECT intraid, u_id FROM users');
        users = users.rows;
    }
    catch (e) {
        logger_1.errorLogger.error('Scheduled userupdater failed to get users from database');
    }
    const client = yield queries_1.default.connect();
    try {
        yield client.query('BEGIN');
        for (var i = 0; i < users.length; i++) {
            let userinfo = yield api.intraApi('/users/' + users[i].intraid);
            yield utils.sleep(1000);
            yield utils.sleep(1000);
            yield client.query(`UPDATE users SET
					profile_pic = $1,
					level = $2,
					grade = $3,
					class_of = $4,
					wallet = $5,
					location = $6,
					correction_points = $7,
					achievement_points = $8,
					active = $9
					WHERE u_id = $10`, [
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
                users[i].u_id,
            ]);
        }
        yield client.query('COMMIT');
    }
    catch (e) {
        logger_1.errorLogger.error('Failed to update users: ' + e);
        yield client.query('ROLLBACK');
    }
    finally {
        client.release();
    }
});
module.exports = {
    update: () => updateUsers(),
};
//# sourceMappingURL=update-users.js.map