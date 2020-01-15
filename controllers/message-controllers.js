const { validationResult } = require('express-validator');
const db = require('../queries');
const logger = require('../logger');

const getMessagesByThreadId = async (req, res) => {
    const threadId = req.params.tid;

    let messages;
    try {
        messages = await db.query('SELECT username, u_id, profile_pic, m_id, message, time_sent ' +
            'FROM messages JOIN threads ON t_id = $1 AND messages.thread = $1 ' +
            'JOIN users on users.u_id = messages.sender;', [threadId]);
        messages = messages.rows;
    } catch (e) {
        logger.info(`Failed to get messages: \n\n${e}`);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get messages'
        })
    }
    res.json(messages)
};

const getThreadsByUserId = async (req, res) => {
    const userId = req.decoded.u_id; // always more secure to get u_id from decoded token!!

    let threads;
    try {
        threads = await db.query(
            'SELECT user_id, username, u_id, profile_pic, thread_id ' +
            'FROM users JOIN threadconnections ' +
            'ON threadconnections.user_id = users.u_id WHERE users.u_id = $1',
            [userId]
        );
        threads = threads.rows;
    } catch (e) {
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get threads'
        })
    }
    res.json(threads);
};

exports.getMessagesByThreadId = getMessagesByThreadId;
exports.getThreadsByUserId = getThreadsByUserId;