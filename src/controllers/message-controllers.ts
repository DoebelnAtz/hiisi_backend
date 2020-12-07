import { catchErrors } from '../errors/catchErrors';
import CustomError from '../errors/customError';

import db from '../postgres/queries';

export const getMessagesByThreadId = catchErrors(async (req, res) => {
	const threadId = req.params.tid;
	const page = req.query.page;

	let isAllowed = await db.query(
		`SELECT thread_name from threadconnections JOIN threads
				ON thread_id = t_id
				WHERE user_id = $1 AND thread_id = $2`,
		[req.decoded.u_id, threadId],
	);
	if (!isAllowed.rows.length) {
		throw new CustomError('Failed to get messages: unauthorized', 401);
	}
	let messages = await db.query(
		`SELECT * FROM 
			(SELECT username, u_id, profile_pic, m.m_id, m.message, m.time_sent 
				FROM messages m JOIN threads t ON  t.t_id = m.thread
            	LEFT JOIN users on users.u_id = m.sender 
            WHERE m.thread = $1 
            ORDER BY m.time_sent DESC LIMIT $2 OFFSET $3) 
            AS mes ORDER BY mes.time_sent ASC`,
		[threadId, 20, (page - 1) * 20],
	);

	await db.query(
		`UPDATE online_users SET last_updated = NOW() WHERE u_id = $1 RETURNING u_id`,
		[req.decoded.u_id],
	);

	res.json({ title: isAllowed.rows[0].thread_name, messages: messages.rows });
}, 'Failed to get messages');

export const getUsersInThread = catchErrors(async (req, res) => {
	const threadId = req.params.tid;

	let users = await db.query(
		'SELECT thread_id, username, profile_pic, u_id FROM users ' +
			'JOIN threadconnections ON user_id = u_id WHERE thread_id = $1',
		[threadId],
	);

	res.json(users.rows);
}, 'Failed to get users connected to thread');

export const getThreadsByUserId = catchErrors(async (req, res) => {
	const userId = req.decoded.u_id; // always more secure to get u_id from decoded token!!

	let threads = await db.query(
		`SELECT thread_name, user_id, username, u_id, profile_pic, thread_id, project_thread
				FROM users JOIN threadconnections 
				ON user_id = u_id 
				JOIN threads ON t_id = thread_id 
				WHERE users.u_id = $1`,
		[userId],
	);

	await db.query(
		`UPDATE online_users SET last_updated = NOW() WHERE u_id = $1 RETURNING u_id`,
		[req.decoded.u_id],
	);

	res.json(threads.rows);
}, 'Failed to get messages');

export const createNewThread = catchErrors(async (req, res) => {
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
		throw new Error('Failed to create thread');
	} finally {
		client.release();
	}

	console.log(createdThread);
	res.status(201).json(createdThread);
}, 'Failed to create thread');

export const addUserToThread = catchErrors(async (req, res) => {
	const senderId = req.decoded.u_id;

	const { targetId, threadId } = req.body;

	let checkSenderIsInThread = await db.query(
		`SELECT * FROM threadconnections WHERE user_id = $1 
				AND thread_id = $2`,
		[senderId, threadId],
	);
	if (!checkSenderIsInThread.rows.length) {
		throw new CustomError('Unauthorized sender', 401);
	}

	let addedUser;

	await db.query(
		'INSERT INTO threadconnections (thread_id, user_id) ' +
			'VALUES ($1, $2)',
		[threadId, targetId],
	);
	addedUser = await db.query(
		'SELECT username, profile_pic, u_id FROM users ' + 'WHERE u_id = $1',
		[targetId],
	);
	addedUser = addedUser.rows[0];

	res.json(addedUser);
}, 'Failed to add User to thread');

export const deleteThread = catchErrors(async (req, res) => {
	const senderId = req.decoded.u_id;
	const { targetId } = req.body;
	let fullDelete = false;
	let deleteTarget = await db.query(
		`SELECT thread_id, user_id FROM threads JOIN threadconnections 
	        ON thread_id = t_id 
	        WHERE thread_id = $1`,
		[targetId],
	);
	if (!deleteTarget.rows.length) {
		throw new CustomError('Failed to find thread with provided id', 404);
	} else if (
		!deleteTarget.rows.find((thread: any) => thread.user_id === senderId)
	) {
		throw new CustomError('Unauthorized sender', 401);
	}
	if (deleteTarget.rows.length === 1) {
		fullDelete = true;
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
		throw new Error('Failed to delete thread');
	} finally {
		client.release();
	}
	res.json({ success: true });
}, 'Failed to delete thread');
