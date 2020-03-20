const db = require('../postgres/queries');

const createUser = async (userObj, res) => {

    let createdUser;
    try {
        createdUser = await db.query(
            'INSERT INTO users (username, intraId, password) VALUES ($1, $2, $3) RETURNING u_id, username, intraid',
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

    return (createdUser.rows[0]);
};

exports.createUser = createUser;