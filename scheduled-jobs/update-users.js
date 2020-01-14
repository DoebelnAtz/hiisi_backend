const api = require('./api');
const db = require('../queries');
const logger = require('../logger');
const utils = require('../utils/utils');

const updateUsers = async () => {
    let users;

    try {
        users = await db.query('SELECT intraid, u_id FROM users');
        users = users.rows;
    } catch (e) {
        logger.info('Scheduled userupdater failed to get users from database');
    }

    const client = await db.connect();
    try{
        await client.query('BEGIN');
        for (var i = 0; i < users.length; i++) {

            let userinfo = await api.intraApi('/users/' + users[i].intraid);
            await utils.sleep(1000);
            let coalitioninfo = await api.intraApi('/users/' + users[i].intraid + '/coalitions_users');
            await utils.sleep(1000);
            logger.info(JSON.stringify(users[i]));
            await client.query('UPDATE users SET ' +
                'profile_pic = $1, ' +
                'level = $2,' +
                'grade = $3,' +
                'class_of = $4,' +
                'wallet = $5,' +
                'location = $6,' +
                'correctionpoints = $7,' +
                'achievementpoints = $8,' +
                'active = $9, ' +
                'coalition_rank = $10, ' +
                'coalitionpoints = $11 ' +
                ' WHERE u_id = $12',
                [
                    userinfo.image_url,
                    userinfo.cursus_users[0].level,
                    userinfo.cursus_users[0].grade,
                    userinfo.pool_month + ' ' + userinfo.pool_year,
                    userinfo.wallet,
                    userinfo.location,
                    userinfo.correction_point,
                    utils.countAchievementPoints(userinfo.achievements),
                    !!userinfo.location,
                    coalitioninfo[0].rank,
                    coalitioninfo[0].score,
                    users[i].u_id
                ])
        }
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        console.log(e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to create comment, please try again later.'
        })
    } finally {
        client.release();
    }
};

module.exports = {
    update: () => updateUsers()
};