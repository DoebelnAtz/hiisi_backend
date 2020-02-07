const { validationResult } = require('express-validator');
const db = require('../queries');
const {accessLogger, errorLogger} = require('../logger');

const getMessagesByThreadId = async (req, res) => {
    const threadId = req.params.tid;

    let messages;
    try {
        messages = await db.query('SELECT username, u_id, profile_pic, m_id, message, time_sent ' +
            'FROM messages JOIN threads ON t_id = $1 AND messages.thread = $1 ' +
            'JOIN users on users.u_id = messages.sender;', [threadId]);
        messages = messages.rows;
    } catch (e) {
        errorLogger.error(`Failed to get messages: \n\n${e}`);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get messages'
        })
    }
    try {
        let isAllowed = await db.query('SELECT * from threadconnections where user_id = $1 AND thread_id = $2', [req.decoded.u_id, threadId]);
        if (!isAllowed.rows.length) {
            res.status(401).json({
                status: 'error',
                message: 'unauthorized'
            })
        }
    } catch (e) {
        errorLogger.error(`Failed to get messages: \n\n${e}`);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get messages'
        })
    }

    res.json(messages)
};

const getUsersInThread = async (req, res) => {
    const threadId = req.params.tid;

    let users;
    try {
        users = await db.query(
            'SELECT thread_id, username, profile_pic, u_id FROM users ' +
            'JOIN threadconnections ON user_id = u_id WHERE thread_id = $1'
            ,[threadId]
        );
        users = users.rows;
    } catch (e) {
        errorLogger.error('Failed to get users connected to thread ' + threadId + ': ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get users connected to thread'
        })
    }
    res.json(users);
};

const getThreadsByUserId = async (req, res) => {
    const userId = req.decoded.u_id; // always more secure to get u_id from decoded token!!

    let threads;
    try {
        threads = await db.query(
            'SELECT thread_name, user_id, username, u_id, profile_pic, thread_id ' +
            'FROM users JOIN threadconnections ' +
            'ON user_id = u_id ' +
            'JOIN threads ON t_id = thread_id ' +
            'WHERE users.u_id = $1',
            [userId]
        );
        threads = threads.rows;
    } catch (e) {
        errorLogger.error('Failed to get threads: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get threads'
        })
    }
    res.json(threads);
};

const createNewThread = async (req, res) => {

    const userId = req.decoded.u_id;

    const { threadName } = req.body;

    const client = await db.connect();

    let createdThread;
    try{
        await client.query('BEGIN');
        createdThread = await client.query(
            'INSERT INTO threads (thread_name) ' +
            'VALUES ($1) RETURNING t_id AS thread_id, thread_name',[threadName]);
        createdThread = createdThread.rows[0];
        await client.query(
            'INSERT INTO threadconnections (user_id, thread_id) ' +
            'VALUES ($1, $2)', [userId, createdThread.thread_id]);
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        console.log(e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to create thread, please try again later.'
        })
    } finally {
        client.release();
    }
    console.log(createdThread);
    res.status(201).json(createdThread)
};

const addUserToThread = async (req, res) => {

    const senderId = req.decoded.u_id;

    const { targetId, threadId } = req.body;
    if (!targetId || !threadId) {
        errorLogger.error('Failed to validate user: ' + e);
        return res.status(401).json({
            success: false,
            status: 'error',
            message: 'Failed to validate request'
        })
    }
    try {
        let checkSenderIsInThread = await db.query(
            "SELECT * FROM threadconnections WHERE user_id = $1 " +
            "AND thread_id = $2", [senderId, threadId]);
        if (!checkSenderIsInThread.rows.length) {
            return res.status(401).json({
                success: false,
                status: 'error',
                message: 'Sender is not a member of this thread'
            })
        }
    } catch (e) {
        errorLogger.error('Failed to validate user: ' + e);
        return res.status(500).json({
            success: false,
            status: 'error',
            message: 'Failed to validate request'
        })
    }
    let addedUser;
    try{
        await db.query(
            "INSERT INTO threadconnections (thread_id, user_id) " +
            "VALUES ($1, $2)", [threadId, targetId]);
        addedUser = await db.query(
            'SELECT username, profile_pic, u_id FROM users ' +
            'WHERE u_id = $1', [targetId]);
        addedUser = addedUser.rows[0];
    } catch (e) {
        errorLogger.error('Failed to add user to thread: ' + e);
        return res.status(500).json({
            success: false,
            status: 'error',
            message: 'Failed to add User to thread'
        })
    }
    res.json(addedUser);
};

exports.getMessagesByThreadId = getMessagesByThreadId;
exports.getThreadsByUserId = getThreadsByUserId;
exports.createNewThread = createNewThread;
exports.addUserToThread = addUserToThread;
exports.getUsersInThread = getUsersInThread;