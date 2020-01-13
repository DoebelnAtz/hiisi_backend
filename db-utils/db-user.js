const db = require('../queries');

const createUser = async (userObj) => {
    try {
        await db.query('INSERT INTO users (username, intraId, password) VALUES ($1, $2, $3)',
            [
                userObj.username,
                userObj.intraId,
                userObj.hashedPassword
            ]
        )
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            status: 'error',
            message: 'Sign up failed, please try again later.'
        })
    }

    let createdUser;
    try {
        createdUser = await db.query('SELECT id, username, intraId FROM users WHERE username = $1', [userObj.username])
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            status: 'error',
            message: 'Sign up failed, please try again later.'
        })
    }
    return (createdUser.rows[0]);
};

exports.createUser = createUser;