const api = require('./api');
const db = require('../queries');
const logger = require('../logger');

const updateUsers = async () => {
    let users;

    try {
        users = await db.query('SELECT intraid, u_id FROM users');
        users = users.rows;
    } catch (e) {
        logger.info('Scheduled userupdater failed to get users from database');
    }
    for (var i = 0; i < users.length; i++) {
        logger.info(JSON.stringify(users[i]))
    }
};

module.exports = {
    update: () => updateUsers()
};