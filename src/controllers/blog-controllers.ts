import { catchErrors } from '../errors/catchErrors';
import CustomError from '../errors/customError';
import { transaction } from '../errors/transaction';
import db from '../postgres/queries';

const { errorLogger } = require('../logger');

export const getBlogs = catchErrors(async (req, res) => {
	const senderId = req.decoded.u_id; // get sender id from decoded token
	let order = req.query.order || 'popular';
	let pagination = req.query.page || 1;
	let reverse = req.query.reverse || 'false';
	if (order !== 'popular' && order !== 'recent' && order !== 'title') {
		errorLogger.error(`Failed to get blogs: invalid order parameter`);
		return res.status(422).json({
			status: 'error',
			message: 'Failed to get blogs',
		});
	}
	let order1;
	let order2;
	let reverseOrder;
	switch (order) {
		case 'popular':
			reverseOrder = reverse === 'true' ? 'ASC' : 'DESC';
			order1 = `votes ${reverseOrder}`;
			order2 = 'published_date DESC';
			break;
		case 'recent':
			reverseOrder = reverse === 'true' ? 'ASC' : 'DESC';
			order1 = `published_date ${reverseOrder}`;
			order2 = 'votes DESC';
			break;
		default:
			reverseOrder = reverse === 'true' ? 'DESC' : 'ASC';
			order1 = `title ${reverseOrder}`;
			order2 = 'published_date DESC';
	}
	const perPage = 14;
	const userId = req.decoded.u_id;
	let blogs;

	let query = `
		SELECT 
			b.b_id, b.title, b.content, b.author, b.published_date, b.edited, b.commentthread,
			u.username, u.u_id,
			COALESCE(v.votes, 0) AS votes, bv.vote AS voted
		FROM blogs b JOIN users u
		ON b.author = u.u_id 
		LEFT JOIN (SELECT b_id, SUM(vote) AS votes FROM blogvotes GROUP BY b_id) v
		ON v.b_id = b.b_id
		LEFT JOIN (SELECT b_id, vote FROM blogvotes
			WHERE u_id = $1) bv
		 ON bv.b_id = b.b_id 
		ORDER BY ${order1}, ${order2} LIMIT $2 OFFSET $3
		`;
	try {
		blogs = await db.query(query, [
			userId,
			perPage,
			(pagination - 1) * perPage,
		]);
		blogs = blogs.rows;
		blogs.map((blog: any) => (blog.owner = blog.u_id === senderId));
	} catch (e) {
		errorLogger.error(`'Failed to get blogs: ${e} ${query}`);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to get blogs',
		});
	}
	res.json(blogs);
}, 'Failed to get blogs');

export const getBlogById = catchErrors(async (req, res) => {
	const blogId = req.params.bid;

	let blog;

	blog = await db.query(
		`SELECT b.title, b.content, b.edited,
		b.b_id, b.commentthread, b.published_date, 
		u.username, u.u_id, u.profile_pic
		FROM blogs b JOIN users u ON u.u_id = author WHERE b_id = $1`,
		[blogId],
	);
	blog = blog.rows[0];
	blog.owner = blog.u_id === req.decoded.u_id;

	res.json(blog);
}, 'Failed to get post by id');

export const getBlogsByUserId = catchErrors(async (req, res) => {
	const userId = req.params.uid;
	let blogs;
	try {
		blogs = await db.query('SELECT * FROM blogs WHERE author = $1', [
			userId,
		]);
		blogs = blogs.rows;
	} catch (e) {
		errorLogger.error(`Failed to get blog by user id: ${e}`);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to get post by user id',
		});
	}

	res.json(blogs);
}, 'Failed to get posts by user id');

export const createBlog = catchErrors(async (req, res) => {
	const { title, content } = req.body;

	const authorId = req.decoded.u_id;

	const client = await db.connect();

	let createdBlog;
	try {
		await client.query('BEGIN');
		let res = await client.query(
			`INSERT INTO commentthreads
			DEFAULT VALUES RETURNING t_id`,
		);
		res = res.rows[0];
		createdBlog = await client.query(
			`INSERT INTO blogs(title, content, author, commentthread)
				VALUES($1, $2, $3, $4) 
				RETURNING b_id, title, content, author, commentthread, votes, published_date`,
			[title, content, authorId, res.t_id],
		);
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		if (e.code === '23505') {
			throw new CustomError('Title already exists', 400);
		} else {
			throw new Error('Failed to create post');
		}
	} finally {
		client.release();
	}
	res.status(201).json(createdBlog.rows[0]);
}, 'Failed to create post');

export const voteBlog = catchErrors(async (req, res) => {
	let { vote, blogId } = req.body;
	const userId = req.decoded.u_id;
	let voteTarget = await db.query(
		`SELECT l.b_id, l.vote 
			FROM blogvotes l 
			WHERE l.b_id = $1 AND l.u_id = $2`,
		[blogId, userId],
	);

	voteTarget = voteTarget.rows[0];

	const client = await db.connect();

	await transaction(
		async () => {
			if (!!voteTarget) {
				switch (vote) {
					case 0:
						vote = -voteTarget.vote;
						await client.query(
							`DELETE FROM blogvotes WHERE b_id = $1 AND u_id = $2`,
							[blogId, userId],
						);
						break;
					case 1:
						vote = 2;
						await client.query(
							`UPDATE blogvotes
                            SET vote = 1 
                            WHERE b_id = $1 AND u_id = $2`,
							[blogId, userId],
						);
						break;
					case -1:
						vote = -2;
						await client.query(
							`UPDATE blogvotes
                            SET vote = -1 
                            WHERE b_id = $1 AND u_id = $2`,
							[blogId, userId],
						);
						break;
					default:
						errorLogger.error(
							'Failed to vote blog: Invalid vote input',
						);
						return res.status(500).json({
							success: false,
							status: 'error',
							message: 'Failed to vote blog.',
						});
				}
			} else {
				await client.query(
					`INSERT INTO 
                    blogvotes (b_id, u_id, vote) 
                    VALUES ($1, $2, $3)`,
					[blogId, userId, vote],
				);
			}
		},
		client,
		'Failed to vote on post',
	);
	res.json({ success: true });
}, 'Failed to vote on post');

export const updateBlog = catchErrors(async (req, res) => {
	const { content, title, postId } = req.body;
	const senderId = req.decoded.u_id;
	let updatedBlog = await db.query(
		`UPDATE blogs
		SET
		title = $1,
		content = $2,
		edited = NOW()
		WHERE b_id = $3 AND author = $4`,
		[title, content, postId, senderId],
	);
	updatedBlog = updatedBlog.rows[0];
	res.json(updatedBlog);
}, 'Failed to update post');

export const deleteBlog = catchErrors(async (req, res) => {
	const senderId = req.decoded.u_id;

	const { blogId } = req.body;
	let blogToDelete = await db.query(
		`SELECT b_id, commentthread FROM blogs WHERE b_id = $1 AND author = $2`,
		[blogId, senderId],
	);
	if (blogToDelete.rows.length !== 1) {
		throw new CustomError('Failed to find post with provided id', 404);
	}
	blogToDelete = blogToDelete.rows[0];
	const client = await db.connect();

	await transaction(
		async () => {
			await client.query(`DELETE FROM blogvotes WHERE b_id = $1`, [
				blogId,
			]);
			await client.query(`DELETE FROM blogs WHERE b_id = $1`, [blogId]);
			await client.query(
				`
			DELETE FROM commentthreads WHERE t_id = $1`,
				[blogToDelete.commentthread],
			);
		},
		client,
		'Failed to delete post',
	);

	res.json({ success: true });
}, 'Failed to delete post');
