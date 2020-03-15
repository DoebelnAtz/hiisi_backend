const { validationResult } = require('express-validator');
const { errorLogger, accessLogger } = require('../logger');
const db = require('../postgres/queries');
const dbNotifications = require('../db-utils/db-notifications');


const getCommentThreadById = async (req, res) => {
	const { tid } = req.params;

	let sender;

	const { senderId } = req.decoded.u_id;

	try {
		// could be optimized by returning necessary comment data through comments JOIN voted..., keep as is for now..
		sender = await db.query(
			'SELECT comment_id, vote ' +
				'FROM users join votedcomments ON votedcomments.user_id = users.u_id ' +
				'WHERE users.u_id = $1',
			[senderId],
		);
		sender = sender.rows.map((row) => {
			return {
				c_id: row.comment_id,
				vote: row.vote,
			};
		});
	} catch (e) {
		errorLogger.error('Failed to retrieve blogs: ' + e);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to get blogs',
		});
	}

	let commentThread;
	try {
		commentThread = await db.query(
			'SELECT comments.c_id, commentcontent, author, parentthread, ' +
				'comment_date, childthread, username, profile_pic, u_id ' +
				'FROM comments JOIN users ON comments.parentthread = $1 ' +
				'WHERE comments.author = users.u_id ORDER BY comment_date ASC',
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
	res.json(
		commentThread.map((comment) => {
			return {
				...comment,
				vote: sender.find((v) => {
					return v.c_id === comment.c_id;
				})
					? sender.find((v) => v.c_id === comment.c_id).vote
					: 'no',
				// sends true if up voted, false if down voted,
				// 'no' if not voted.. not perfect, table value is boolean, worth changing?
			};
		}),
	);
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
			errorLogger.error(`Failed to create comment: Failed to find comment thread with the given thread id`);
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
			dbNotifications.createNotification(
				{
					type: 'reply',
					userId: thread.author,
					message: `${req.decoded.username} replied to your comment`,
					link: `${originLink}?comment=${thread.t_id}`
				}
			)
		} catch (e) {
			errorLogger.error('Failed to create notification: ' + e);
		}
	}
	res.status(201).json({ ...createdComment.rows[0], username: req.decoded.username, profile_pic: `https://cdn.intra.42.fr/users/medium_${req.decoded.username}.jpg` });
};

const deleteComment = async (req,res) => {
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
        commentToDelete = await db.query(`
            SELECT c_id, author FROM comments WHERE c_id = $1
        `, [commentId]);
        commentToDelete = commentToDelete.rows;
        if (!commentToDelete.rows.length) {
            errorLogger.error('Failed to find comment with the provided Id');
            return res.status(404).json({
                status: 'error',
                message: 'Failed to find comment with the provided Id'
            })
        } else {
            commentToDelete = commentToDelete[0];
        }
        if (commentToDelete.author !== req.decoded.u_id) {
            errorLogger.error('You are not the author of this comment');
            return res.status(403).json({
                status: 'error',
                message: 'You are not the author of this comment'
            })
        }
    } catch(e) {
        errorLogger.error('Failed to delete comment: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to delete comment'
        })
    }
    const client = await db.connect();

    try{
        await client.query('BEGIN');
        await client.query(`
            UPDATE comments SET author = null, commentcontent = 'deleted' WHERE c_id = $1 
        `, [commentId]);
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        errorLogger.error('Failed to delete comment: ' + e);
        return res.status(500).json({
            success: false,
            status: 'error',
            message: 'Failed to delete comment'
        })
    } finally {
        client.release();
    }
    res.json({success: true})
};

exports.deleteComment = deleteComment;
exports.getCommentThreadById = getCommentThreadById;
exports.createComment = createComment;
