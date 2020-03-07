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
    const page = req.query.page || 1;
    const senderId =  req.decoded.u_id;
    const userId = req.query.user || senderId;
    const filter = req.query.filter;
    const order = req.query.order;
    const reverse = req.query.reverse;

    // we are dangerously inserting values into a query so we need to make sure that
    // the order parameter is correct
    if (order !== 'popular' && order !== 'recent' && order !== 'title') {
        errorLogger.error('Failed to get resources: invalid order parameter');
        return res.status(422).json({
            status: 'error',
            message: 'Failed to get resources',
        });
    }
    let order1;
    let order2;
    let reverseOrder;
    switch (order) {
        case 'popular':
            reverseOrder = reverse === 'true' ? 'ASC' : 'DESC';
            order1 = `res.votes ${reverseOrder}`;
            order2 = 'res.published_date DESC';
            break;
        case 'recent':
            reverseOrder = reverse === 'true' ? 'ASC' : 'DESC';
            order1 = `res.published_date ${reverseOrder}`;
            order2 = 'res.votes DESC';
            break;
        default:
            reverseOrder = reverse === 'true' ? 'DESC' : 'ASC';
            order1 = `res.title ${reverseOrder}`;
            order2 = 'res.published_date DESC';
    }
    console.log(filter);
    let userSubmissions;
    try {
        if (filter === 'none') {
            userSubmissions = await db.query(
                `SELECT * FROM (
            SELECT p.title, null AS thumbnail, p.votes, pv.vote, p.published_date,
            p.project_id as id, 'project' AS type, '/projects' AS link
            FROM projects p 
            LEFT JOIN projectvotes pv ON pv.project_id = p.project_id AND pv.u_id = $2
            WHERE p.creator = $1
            UNION ALL 
            SELECT r.title, r.thumbnail, r.votes, rv.vote, r.published_date,
            r.r_id AS id, 'resource' AS type, '/resources' AS link 
            FROM resources r 
            LEFT JOIN voteconnections rv ON r.r_id = rv.r_id AND rv.u_id = $2 
            WHERE r.author = $1
            UNION ALL 
            SELECT b.title,  null AS thumbnail, b.votes, bv.vote, b.published_date,
            b.b_id AS id, 'post' AS type, '/forum' AS link 
            FROM blogs b 
            LEFT JOIN likedposts bv ON bv.b_id = b.b_id AND bv.u_id = $2
            WHERE b.author =$1
            ) AS res ORDER BY ${order1}, ${order2} LIMIT $3 OFFSET $4`, [userId, senderId, 14, (page - 1) * 14]);
        } else {
            // Messy query, might be better to just do a switch / case..
            const table = filter === 'posts' ? 'blogs' : filter === 'resources' ? filter : 'projects';
            const votes = filter === 'posts' ? 'likedposts' : filter === 'resources' ? 'voteconnections'  : 'projectvotes';
            const id = filter === 'posts' ? 'b_id' : filter === 'resources' ? 'r_id' : 'project_id';
            userSubmissions = await db.query(
                `SELECT * FROM (
            SELECT title, ${table === 'resources' ? 'thumbnail' : 'null'} AS thumbnail, votes, vote, published_date,
            t.${id} as id, '${filter.slice(0, filter.length - 1)}' AS type, '/${filter}' AS link
            FROM ${table} t
            LEFT JOIN ${votes} tv ON tv.${id} = t.${id} AND tv.u_id = $2
            WHERE t.${table === 'projects' ? 'creator' : 'author'} = $1
            ) AS res ORDER BY ${order1}, ${order2} LIMIT $3 OFFSET $4`, [userId, senderId, 14, (page - 1) * 14]);
        }
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

exports.getAllByUserId = getAllByUserId;
exports.searchUsers = searchUsers;