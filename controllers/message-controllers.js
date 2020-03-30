const { validationResult } = require('express-validator');
const db = require('../postgres/queries');
const { accessLogger, errorLogger } = require('../logger');

const getMessagesByThreadId = async (req, res) => {
	const threadId = req.params.tid;
	const page = req.query.page;
	let messages;
	try {
		messages = await db.query(
			`SELECT * FROM (SELECT username, u_id, profile_pic, m.m_id, m.message, m.time_sent 
				FROM messages m JOIN threads t ON  t.t_id = m.thread
            JOIN users on users.u_id = m.sender WHERE m.thread = $1 ORDER BY m.time_sent DESC LIMIT $2 OFFSET $3) AS mes ORDER BY mes.time_sent ASC`,
			[threadId, 20, (page - 1) * 20],
		);
		messages = messages.rows;
	} catch (e) {
		errorLogger.error(`Failed to get messages: \n\n${e}`);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to get messages',
		});
	}
	let isAllowed;
	try {
		isAllowed = await db.query(
			'SELECT thread_name from threadconnections JOIN threads ' +
				'ON thread_id = t_id ' +
				'WHERE user_id = $1 AND thread_id = $2',
			[req.decoded.u_id, threadId],
		);
		if (!isAllowed.rows.length) {
			res.status(401).json({
				status: 'error',
				message: 'unauthorized',
			});
		}
	} catch (e) {
		errorLogger.error(`Failed to get messages: \n\n${e}`);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to get messages',
		});
	}
	try {
		let user = await db.query(
			`UPDATE online_users SET last_updated = NOW() WHERE u_id = $1 RETURNING u_id`,
			[req.decoded.u_id],
		);
	} catch (e) {
		errorLogger.error(
			`Failed to update online user while retrieving messages: ${e}`,
		);
		return res.status().json({
			status: 'error',
			message: 'Failed to get messages',
		});
	}
	res.json({ title: isAllowed.rows[0].thread_name, messages });
};

const getUsersInThread = async (req, res) => {
	const threadId = req.params.tid;

	let users;
	try {
		users = await db.query(
			'SELECT thread_id, username, profile_pic, u_id FROM users ' +
				'JOIN threadconnections ON user_id = u_id WHERE thread_id = $1',
			[threadId],
		);
		users = users.rows;
	} catch (e) {
		errorLogger.error(
			'Failed to get users connected to thread ' + threadId + ': ' + e,
		);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to get users connected to thread',
		});
	}
	res.json(users);
};

const getThreadsByUserId = async (req, res) => {
	const userId = req.decoded.u_id; // always more secure to get u_id from decoded token!!

	let threads;
	try {
		threads = await db.query(
			`SELECT thread_name, user_id, username, u_id, profile_pic, thread_id, project_thread
				FROM users JOIN threadconnections 
				ON user_id = u_id 
				JOIN threads ON t_id = thread_id 
				WHERE users.u_id = $1`,
			[userId],
		);
		threads = threads.rows;
	} catch (e) {
		errorLogger.error('Failed to get threads: ' + e);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to get threads',
		});
	}
	try {
		let user = await db.query(
			`UPDATE online_users SET last_updated = NOW() WHERE u_id = $1 RETURNING u_id`,
			[req.decoded.u_id],
		);
	} catch (e) {
		errorLogger.error(
			`Failed to update online user while retrieving messages: ${e}`,
		);
		return res.status().json({
			status: 'error',
			message: 'Failed to get messages',
		});
	}
	res.json(threads);
};

const createNewThread = async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(422).json({
			status: 'error',
			message: 'Invalid input please try again.',
		});
	}
	const userId = req.decoded.u_id;

	const { threadName } = req.body;

	const client = await db.connect();

	let createdThread;
	try {
		await client.query('BEGIN');
		createdThread = await client.query(
			`INSERT INTO threads (thread_name) 
				VALUES ($1) RETURNING t_id AS thread_id, thread_name`,
			[threadName],
		);
		createdThread = createdThread.rows[0];
		await client.query(
			'INSERT INTO threadconnections (user_id, thread_id) ' +
				'VALUES ($1, $2)',
			[userId, createdThread.thread_id],
		);
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		console.log(e);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to create thread, please try again later.',
		});
	} finally {
		client.release();
	}

	console.log(createdThread);
	res.status(201).json(createdThread);
};

const addUserToThread = async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(422).json({
			status: 'error',
			message: 'Invalid input please try again.',
		});
	}
	const senderId = req.decoded.u_id;

	const { targetId, threadId } = req.body;
	if (!targetId || !threadId) {
		errorLogger.error('Failed to validate user: ' + e);
		return res.status(401).json({
			success: false,
			status: 'error',
			message: 'Failed to validate request',
		});
	}
	try {
		let checkSenderIsInThread = await db.query(
			`SELECT * FROM threadconnections WHERE user_id = $1 
				AND thread_id = $2`,
			[senderId, threadId],
		);
		if (!checkSenderIsInThread.rows.length) {
			return res.status(401).json({
				success: false,
				status: 'error',
				message: 'Sender is not a member of this thread',
			});
		}
	} catch (e) {
		errorLogger.error('Failed to validate user: ' + e);
		return res.status(500).json({
			success: false,
			status: 'error',
			message: 'Failed to validate request',
		});
	}
	let addedUser;
	try {
		await db.query(
			'INSERT INTO threadconnections (thread_id, user_id) ' +
				'VALUES ($1, $2)',
			[threadId, targetId],
		);
		addedUser = await db.query(
			'SELECT username, profile_pic, u_id FROM users ' +
				'WHERE u_id = $1',
			[targetId],
		);
		addedUser = addedUser.rows[0];
	} catch (e) {
		errorLogger.error('Failed to add user to thread: ' + e);
		return res.status(500).json({
			success: false,
			status: 'error',
			message: 'Failed to add User to thread',
		});
	}
	res.json(addedUser);
};

const deleteThread = async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(422).json({
			status: 'error',
			message: 'Invalid input please try again.',
		});
	}
	const senderId = req.decoded.u_id;
	const { targetId } = req.body;
	let fullDelete = false;
	let deleteTarget;
	try {
		deleteTarget = await db.query(
			`SELECT thread_id, user_id FROM threads JOIN threadconnections 
	        ON thread_id = t_id 
	        WHERE thread_id = $1`,
			[targetId],
		);
		deleteTarget = deleteTarget.rows;
		if (!deleteTarget.length) {
			errorLogger.error(
				`Failed to find thread to delete: failed to find thread with provided id`,
			);
			return res.status(404).json({
				status: 'error',
				message: 'Failed to find thread with provided id',
			});
		} else if (
			!deleteTarget.find((thread) => thread.user_id === senderId)
		) {
			errorLogger.error(
				`Failed to find thread to delete: unauthorized sender`,
			);
			return res.status(401).json({
				status: 'error',
				message: 'Unauthorized sender',
			});
		}
		if (deleteTarget.length === 1) {
			fullDelete = true;
		}
	} catch (e) {
		errorLogger.error(`Failed to find thread to delete: ${e}`);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to find thread to delete',
		});
	}

	const client = await db.connect();

	try {
		await client.query('BEGIN');
		await client.query(
			`
				DELETE FROM threadconnections WHERE thread_id = $1 AND user_id = $2
			`,
			[targetId, senderId],
		);

		if (fullDelete) {
			await client.query(
				`
				DELETE FROM messages WHERE thread = $1
			`,
				[targetId],
			);
			await client.query(
				`
				DELETE FROM threads WHERE t_id = $1
			`,
				[targetId],
			);
		}
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		console.log(e);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to delete thread, please try again later.',
		});
	} finally {
		client.release();
	}
	res.json({ success: true });
};

module.exports = {
	getMessagesByThreadId,
	getThreadsByUserId,
	createNewThread,
	addUserToThread,
	getUsersInThread,
	deleteThread,
};
