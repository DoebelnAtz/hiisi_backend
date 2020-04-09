const api = require('./api');
import db from '../postgres/queries';
import { accessLogger, errorLogger } from '../logger';
const utils = require('../utils/utils');

const updateUsers = async () => {
	let users;

	try {
		users = await db.query('SELECT intraid, u_id FROM users');
		users = users.rows;
	} catch (e) {
		errorLogger.error(
			'Scheduled userupdater failed to get users from database',
		);
	}

	const client = await db.connect();
	try {
		await client.query('BEGIN');
		for (var i = 0; i < users.length; i++) {
			let userinfo = await api.intraApi('/users/' + users[i].intraid);
			await utils.sleep(1000);
			await utils.sleep(1000);
			await client.query(
				`UPDATE users SET
					profile_pic = $1,
					level = $2,
					grade = $3,
					class_of = $4,
					wallet = $5,
					location = $6,
					correction_points = $7,
					achievement_points = $8,
					active = $9
					WHERE u_id = $10`,
				[
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
				],
			);
		}
		await client.query('COMMIT');
	} catch (e) {
		errorLogger.error('Failed to update users: ' + e);
		await client.query('ROLLBACK');
	} finally {
		client.release();
	}
};

module.exports = {
	update: () => updateUsers(),
};
