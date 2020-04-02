import { catchErrors } from '../errors/catchErrors';
import CustomError from '../errors/customError';
import db from '../postgres/queries';
//const dbNotifications = require('../db-utils/db-notifications');

export const getCommentThreadById = catchErrors(async (req, res) => {
	const { tid } = req.params;

	// recursive comment query, adjust depth < x to set max depth

	let commentThread = await db.query(
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

	// we don't return a 404 here because a comment thread might be empty
	res.json(commentThread);
}, 'Failed to get comments');

export const createComment = catchErrors(async (req, res) => {
	const authorId = req.decoded.u_id;
	const { threadId, content } = req.body;
	let thread;
	thread = await db.query(
		`SELECT t_id, author 
			FROM commentthreads 
			LEFT JOIN comments 
			ON t_id = childthread WHERE t_id = $1`,
		[threadId],
	);
	if (!(thread = thread.rows[0])) {
		throw new CustomError(
			'Failed to find comment with provided thread id',
			404,
		);
	}
	const client = await db.connect();
	let createdComment;
	try {
		await client.query('BEGIN');
		thread = await client.query(
			'INSERT INTO commentthreads DEFAULT VALUES RETURNING t_id',
		);
		thread = thread.rows[0];
		createdComment = await client.query(
			`INSERT INTO comments(commentcontent, author, parentthread, childthread)
				VALUES($1, $2, $3, $4)
				RETURNING c_id, commentcontent,
			author as u_id, parentthread, childthread, comment_date`,
			[content, authorId, threadId, thread.t_id],
		);
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		throw new Error('Failed to create comment');
	} finally {
		client.release();
	}

	res.status(201).json({
		...createdComment.rows[0],
		username: req.decoded.username,
		profile_pic: `https://cdn.intra.42.fr/users/medium_${req.decoded.username}.jpg`,
	});
}, 'Failed to create comment');

export const deleteComment = catchErrors(async (req, res) => {
	const { commentId } = req.body;

	let commentToDelete = await db.query(
		`
		SELECT c_id, author FROM comments WHERE c_id = $1
	`,
		[commentId],
	);
	if (!commentToDelete.rows.length) {
		throw new CustomError(
			`Failed to find comment to delete with provided comment id`,
			404,
		);
	} else {
		commentToDelete = commentToDelete.rows;
		commentToDelete = commentToDelete[0];
	}
	if (commentToDelete.author !== req.decoded.u_id) {
		throw new CustomError('Unauthorized comment deletion', 403);
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
		throw Error;
	} finally {
		client.release();
	}

	res.json({ success: true });
}, 'Failed to delete comment');
