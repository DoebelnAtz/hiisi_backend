const api = require('../scheduled-jobs/api');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const db = require('../queries');
const { errorLogger } = require('../logger');
const dbUsers = require('../db-utils/db-user');
let jwt = require('jsonwebtoken');
let config = require('../config');
const users = require('./../users');
const utils = require('../utils/utils');

const getMe = async (req, res) => {
    // More secure version of getUserById, it gets the uid from token supplied id
    const userId = req.decoded.u_id;
    let user;
    try {
        user = await db.query(
            `SELECT
            u_id,
            username,
            intraid, 
            profile_pic, 
            coalition_points, 
            coalition_rank,
            grade, 
            level, 
            class_of, 
            wallet, 
            location, 
            active, 
            correction_points, 
            achievement_points 
            FROM users WHERE u_id = $1`, [userId]);
        user = user.rows[0];
    } catch (e) {
        errorLogger.error('Failed to get users by id: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get users by id.'
        })
    }
    if (!user) {
        return res.status(404).json({
            status: 'error',
            message: 'Couldn\'t find user matching given id.'
        })
    }
    res.json(user);
};

const getUserFriends = async (req, res) => {

    const { uid } = req.params;

    let friends;
    try {
        friends = await db.query(
            'SELECT u_id, username, profile_pic ' +
            'FROM users JOIN friends ON users.u_id = friends.two_id WHERE friends.one_id = $1',
            [uid]
        ); // not very descriptive column names (google many to many relationship)...
        friends = friends.rows;
    } catch (e) {
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get friends'
        })
    }
    res.json({friends: friends.map(friend => friend)});
};



const getUsers = async (req, res) => {

    let users;
    try {
        users = await db.query(
            `SELECT
            u_id, 
            username, 
            profile_pic, 
            coalition_points, 
            coalition_rank, 
            grade, 
            level, 
            class_of, 
            wallet, 
            location, 
            active, 
            correction_points, 
            achievement_points 
            FROM users`);
        users = users.rows;
    } catch (e) {
        return console.log('ERROR: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get users.'
        })
    }

    res.json( users.map(user => user));
};



const getUserById = async (req, res) => {

    const userId = req.params.pid;

    let user;
    try {
        user = await db.query(
            `SELECT 
            u_id, 
            username, 
            intraid, 
            profile_pic, 
            coalition_points, 
            coalition_rank, 
            grade, 
            level, 
            class_of, 
            wallet,
            location, 
            active, 
            correction_points, 
            achievement_points 
            FROM users WHERE u_id = $1`, [userId]);
        user = user.rows[0];
    } catch (e) {
        errorLogger.error('Failed to get users by id: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get users by id.'
        })
    }
    if (!user) {
        return res.status(404).json({
            status: 'error',
            message: 'Couldn\'t find user matching given id.'
        })
    }

    res.json(user);
};



const signUp = async (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(401).json({
            status: 'error',
            message: 'Invalid input.'
        })
    }
    const { username, password } = req.body;
    let intraId = users.find((user) => {
        console.log(user.login, user.id);
        return user.login === username
    }).id;

    let existingUser;
    try {
        existingUser = await db.query("SELECT * FROM users WHERE username = $1", [username]);
        existingUser = existingUser.rows[0]; // can't do db.query().rows[0] directly
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            status: 'error',
            message: 'Sign up failed, please try again later.'
        });
    }

    if (existingUser) {
        return res.status(401).json({
            status: 'error',
            message: 'User already exists'
        })
    }

    let hashedPassword;
    try {
        hashedPassword = await bcrypt.hash(password, 10);
    } catch (e) {
        return res.status(500).json({
            status: 'error',
            message: 'Sign up failed, please try again later.'
        })
    }

    let createdUser = {
        username,
        intraId,
        hashedPassword,
    };

    const client = await db.connect();
    try{
        await client.query('BEGIN');
        let userinfo = await api.intraApi('/users/' + intraId);
        await utils.sleep(1000);
        await client.query(`
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
                userinfo.pool_month + ' ' + userinfo.pool_year,
                userinfo.wallet,
                userinfo.location,
                userinfo.correction_point,
                utils.countAchievementPoints(userinfo.achievements),
                !!userinfo.location,
            ]);
        await client.query('COMMIT');
    } catch (e) {
        errorLogger.error('Failed to create user: ' + e);
        await client.query('ROLLBACK');
        return res.status(500).json(
            {
                status: 'Error',
                message: 'Failed to create user'
            },
        )
    } finally {
        client.release();
    }
    res.status(201).json({createdUser: createdUser });
};



const login = async (req, res, next) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            status: 'error',
            message: 'Log in failed, please try again.'
        })
    }

    const { username, password } = req.body;

    let existingUser;
    try {
        existingUser = await db.query('SELECT username, u_id, password FROM users WHERE username = $1', [username.toLowerCase()]);
        existingUser = existingUser.rows[0];
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            status: 'error',
            message: 'Log in failed, please try again later.'
        });
    }

    if (!existingUser) {
        return res.status(401).json({
            status: 'error',
            message: 'Invalid credentials, please try again.'
        })
    }

    let isValidPass = false;
    try {
        isValidPass = await bcrypt.compare(password, existingUser.password)
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            status: 'error',
            message: 'Log in failed, please try again later.'
        })
    }

    if (!isValidPass) {
        return res.status(401).json({
            status: 'error',
            message: 'Invalid credentials, please try again.'
        })
    }
    let token = jwt.sign({username: username, u_id: existingUser.u_id},
        config.secret,
        { expiresIn: '24h' // expires in 24 hours
        }
    );

    try {
        let user = await db.query(
            `UPDATE online_users SET last_updated = NOW() WHERE u_id = $1 RETURNING u_id`, [existingUser.u_id])
        if (!user.rows.length) {
            try {
                await db.query(
                    `INSERT INTO online_users VALUES ($1)`, [existingUser.u_id])
            } catch (e) {
                errorLogger.error(`Failed to create row for online_user: ${e}`);
                return res.status().json({
                    status: 'error',
                    message: 'Failed to log in'
                })
            }
        }
    } catch (e) {
        errorLogger.error(`: ${e}`);
        return res.status().json({
            status: 'error',
            message: 'Failed to log in'
        })
    }
    // return the JWT token for the future API calls
    res.json({
        success: true,
        message: 'Authentication successful!',
        token: token,
        user: existingUser
    });
};

const getOnlineUsers = async (req, res) => {
    let users;

    try {
        users = await db.query(
            `SELECT u_id, last_updated FROM online_users WHERE last_updated > NOW() - interval '5 minutes'`)
        users = users.rows;
    } catch (e) {
        errorLogger.error('Failed to get online users: ' + e)
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get online users'
        })
    }
    res.json(users);
};


const searchUsers = async (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(401).json({
            status: 'error',
            message: 'Invalid search input, please try again.'
        })
    }

    const search = req.query.q;
    console.log(search);
    let usersFound;
    try {
        usersFound = await db.query(
            `SELECT u_id, username, intraid, profile_pic 
            FROM users WHERE username LIKE $1`
            , [search + '%']);
        usersFound = usersFound.rows;
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to search for users'
        })
    }
    res.json(usersFound.map(user => user))
};

const getAllByUserId = async (req, res) => {
    const page = req.query.page;
    const userId = req.query.user;
    const senderId =  req.decoded.u_id;
    let userSubmissions;
    try {
        userSubmissions = await db.query(
            `SELECT * FROM (
            SELECT p.title, null AS thumbnail, p.votes, pv.vote, p.project_id as id, 'project' AS type, '/user' AS link
            FROM projects p 
            LEFT JOIN projectvotes pv ON pv.project_id = p.project_id AND pv.u_id = $2
            WHERE p.creator = $1
            UNION ALL 
            SELECT r.title, r.thumbnail, r.votes, rv.vote, r.r_id AS id, 'resource' AS type, '/resources' AS link 
            FROM resources r 
            LEFT JOIN voteconnections rv ON r.r_id = rv.r_id AND rv.u_id = $2 
            WHERE r.author = $1
            UNION ALL 
            SELECT b.title,  null AS thumbnail, b.votes, bv.vote, b.b_id AS id, 'post' AS type, '/forum' AS link 
            FROM blogs b 
            LEFT JOIN likedposts bv ON bv.b_id = b.b_id AND bv.u_id = $2
            WHERE b.author =$1
            ) AS res LIMIT 10 OFFSET $3`, [userId, senderId, page * 14]);
        userSubmissions = userSubmissions.rows;
    } catch(e) {
        errorLogger.error('Failed to get user submissions: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get user submissions'
        })
    }
    return res.json(userSubmissions);
};

exports.getMe = getMe;
exports.getOnlineUsers = getOnlineUsers;
exports.getUserFriends = getUserFriends;
exports.getUsers = getUsers;
exports.getUserById = getUserById;
exports.signUp = signUp;
exports.login = login;
exports.getAllByUserId = getAllByUserId;
exports.searchUsers = searchUsers;