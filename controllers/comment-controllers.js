const { validationResult } = require('express-validator');
const { errorLogger, accessLogger } = require('../logger');
const db = require('../postgres/queries');
const dbNotifications = require('../db-utils/db-notifications');

const getCommentThreadById = async (req, res) => {
	const { tid } = req.params;

	let sender;

	const { senderId } = req.decoded.u_id;

	let commentThread;
	// recursive comment query, adjust depth < x to set max depth
	try {
		commentThread = await db.query(
			`
			WITH RECURSIVE cmts AS (
				SELECT c.commentcontent, c.c_id, c.parentthread, c.childthread, 
				1 as depth, c.comment_date, u.username, u.u_id, u.profile_pic
				FROM comments c JOIN commentthreads t
				ON c.parentthread = t.t_id 
				LEFT JOIN users u ON c.author = u.u_id
				WHERE t.t_id = $1
				UNION ALL
				SELECT e.commentcontent, e.c_id, e.parentthread, e.childthread, 
				cmts.depth + 1 as depth, e.comment_date,
				eu.username, eu.u_id, eu.profile_pic
				FROM comments e JOIN commentthreads et 
				ON e.parentthread = et.t_id 
				LEFT JOIN users eu ON e.author = eu.u_id
				JOIN cmts ON e.parentthread = cmts.childthread AND depth < 10
			) SELECT * FROM cmts ORDER BY comment_date ASC`,
			[tid],
		);
		commentThread = commentThread.rows;
	} catch (e) {
		errorLogger.error('Failed to retrieve comments: ' + e);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to retrieve comments.',
		});
	}
	res.json(commentThread);
};

const createComment = async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(422).json({
			status: 'error',
			message: 'Invalid inputs passed, please check your data.',
		});
	}
	const authorId = req.decoded.u_id;
	const { threadId, content, originLink } = req.body;
	console.log(threadId, content, authorId);
	let thread;
	try {
		thread = await db.query(
			`SELECT t_id, author 
			FROM commentthreads 
			LEFT JOIN comments 
			ON t_id = childthread WHERE t_id = $1`,
			[threadId],
		);
		if (!(thread = thread.rows[0])) {
			errorLogger.error(
				`Failed to create comment: Failed to find comment thread with the given thread id`,
			);
			return res.status(404).json({
				status: 'error',
				message:
					'Failed to find comment thread with the given thread id',
			});
		}
	} catch (e) {
		errorLogger.error(`Failed to create comment: ${e}`);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to create comment, please try again later',
		});
	}
	const client = await db.connect();
	let createdComment;
	try {
		await client.query('BEGIN');
		let res = await client.query(
			'INSERT INTO commentthreads DEFAULT VALUES RETURNING t_id',
		);
		res = res.rows[0];
		createdComment = await client.query(
			'INSERT INTO comments(commentcontent, author, parentthread, childthread) ' +
				'VALUES($1, $2, $3, $4) ' +
				'RETURNING c_id, commentcontent, author, parentthread, childthread, comment_date',
			[content, authorId, threadId, res.t_id],
		);
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		errorLogger.error('Failed to create comment: ' + e);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to create comment',
		});
	} finally {
		client.release();
	}
	console.log(thread.author, authorId);
	if (thread.author !== authorId) {
		try {
			dbNotifications.createNotification({
				type: 'reply',
				userId: thread.author,
				message: `${req.decoded.username} replied to your comment`,
				link: `${originLink}?comment=${thread.t_id}`,
			});
		} catch (e) {
			errorLogger.error('Failed to create notification: ' + e);
		}
	}
	res.status(201).json({
		...createdComment.rows[0],
		username: req.decoded.username,
		profile_pic: `https://cdn.intra.42.fr/users/medium_${req.decoded.username}.jpg`,
	});
};

const deleteComment = async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(422).json({
			status: 'error',
			message: 'Invalid inputs passed, please check your data.',
		});
	}
	const { commentId } = req.body;
	let commentToDelete;
	try {
		commentToDelete = await db.query(
			`
            SELECT c_id, author FROM comments WHERE c_id = $1
        `,
			[commentId],
		);
		if (!commentToDelete.rows.length) {
			errorLogger.error('Failed to find comment with the provided Id');
			return res.status(404).json({
				status: 'error',
				message: 'Failed to find comment with the provided Id',
			});
		} else {
			commentToDelete = commentToDelete.rows;
			commentToDelete = commentToDelete[0];
		}
		if (commentToDelete.author !== req.decoded.u_id) {
			errorLogger.error('You are not the author of this comment');
			return res.status(403).json({
				status: 'error',
				message: 'You are not the author of this comment',
			});
		}
	} catch (e) {
		errorLogger.error('Failed to delete comment: ' + e);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to delete comment',
		});
	}
	const client = await db.connect();

	try {
		await client.query('BEGIN');
		await client.query(
			`
            UPDATE comments SET author = null, commentcontent = 'deleted' WHERE c_id = $1 
        `,
			[commentId],
		);
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		errorLogger.error('Failed to delete comment: ' + e);
		return res.status(500).json({
			success: false,
			status: 'error',
			message: 'Failed to delete comment',
		});
	} finally {
		client.release();
	}
	res.json({ success: true });
};

module.exports = {
	deleteComment,
	getCommentThreadById,
	createComment,
};
