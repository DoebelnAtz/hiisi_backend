const { validationResult } = require('express-validator');
const { errorLogger } = require('../logger');
const db = require('../queries');

const getBlogs = async (req, res) => {
	let sender;
	const senderId = req.decoded.u_id; // get sender id from decoded token
	let order = req.query.order;
	let pagination = req.query.page;
	let reverse = req.query.reverse;
	if (order !== 'popular' && order !== 'recent' && order !== 'title') {
		errorLogger.error('Failed to get blogs: invalid order parameter');
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
	try {
		sender = await db.query(
			`SELECT b_id, vote FROM users 
            JOIN likedposts ON likedposts.u_id = $1`,
			[senderId],
		);
		sender = sender.rows.map((row) => row.b_id);
	} catch (e) {
		errorLogger.error('Failed to get blogs: ' + e);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to get blogs',
		});
	}

	let blogs;
	try {
		blogs = await db.query(
			`SELECT b.b_id, b.content, b.title, l.vote AS voted,
            b.published_date, b.commentthread, votes, u.u_id, u.username 
            FROM blogs b JOIN users u
            ON b.author = u.u_id 
            LEFT JOIN likedposts l 
            ON l.b_id = b.b_id 
            ORDER BY ${order1}, ${order2} LIMIT $1 OFFSET $2`,
			[Number(pagination) * 10, Number(pagination - 1) * 10],
		);
		blogs = blogs.rows;
		blogs.map((blog) => (blog.owner = blog.u_id === senderId));
	} catch (e) {
		errorLogger.error('Failed to get blogs: ' + e);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to get blogs',
		});
	}
	res.json(blogs);
};

const getBlogById = async (req, res) => {
	const blogId = req.params.bid;

	let blog;
	try {
		blog = await db.query(
			`SELECT b.title, b.content, 
			b.b_id, b.commentthread, b.published_date, 
			u.username, u.u_id, u.profile_pic
			FROM blogs b JOIN users u ON u.u_id = author WHERE b_id = $1`,
			[blogId],
		);
		blog = blog.rows[0];
		blog.owner = blog.u_id = req.decoded.u_id;
	} catch (e) {
		return res.status(500).json({
			status: 'error',
			message: 'Failed to get blog',
		});
	}

	res.json(blog);
};

const getBlogsByUserId = async (req, res) => {
	const userId = req.params.uid;

	let userWithBlogs;
	try {
		userWithBlogs = await db.query(
			'SELECT * FROM blogs WHERE author = $1',
			[userId],
		);
		userWithBlogs = userWithBlogs.rows;
	} catch (e) {
		return res.status(500).json({
			status: 'error',
			message: 'Failed to get blog by user id',
		});
	}

	res.json({ blogs: userWithBlogs.map((blog) => blog) });
};

const createBlog = async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(400).json({
			status: 'error',
			message: 'Invalid input please try again.',
		});
	}

	const { title, authorId, content, published_date } = req.body;

	let user;
	try {
		user = await db.query(
			'SELECT username, intraid FROM users WHERE u_id = $1',
			[authorId],
		);
		user = user.rows[0];
	} catch (e) {
		console.log(e);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to create blog, please try again later',
		});
	}
	if (!user) {
		return res.status(404).json({
			status: 'error',
			message: 'Could not find user with provided id',
		});
	}

	const client = await db.connect();

	let createdBlog;
	try {
		await client.query('BEGIN');
		let res = await client.query(
			'INSERT INTO commentthreads DEFAULT VALUES RETURNING t_id',
		);
		res = res.rows[0];
		createdBlog = await client.query(
			'INSERT INTO blogs(title, content, author, commentthread, published_date) ' +
				'VALUES($1, $2, $3, $4, $5) ' +
				'RETURNING b_id, title, content, author, commentthread, votes, published_date',
			[title, content, authorId, res.t_id, published_date],
		);
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		console.log(e);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to create Blog Post, please try again later.',
		});
	} finally {
		client.release();
	}

	res.status(201).json(createdBlog.rows[0]);
};

const voteBlog = async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(422).json({
			status: 'error',
			message: 'Invalid input please try again.',
		});
	}
	let { vote, blogId } = req.body;
	const userId = req.decoded.u_id;
	let voteTarget;
	try {
		voteTarget = await db.query(
			`SELECT b.title, b.votes, b.b_id, l.vote, l.u_id
            FROM blogs b JOIN likedposts l ON b.b_id = l.b_id 
            WHERE b.b_id = $1`,
			[blogId],
		);
		voteTarget = voteTarget.rows[0];
	} catch (e) {
		errorLogger.error('Failed to find target blog for voting: ' + e);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to find target blog for voting',
		});
	}
	const client = await db.connect();

	try {
		await client.query('BEGIN');
		if (!!voteTarget) {
			switch (vote) {
				case 0:
					vote = -voteTarget.vote;
					await client.query(
						`DELETE FROM likedposts l 
                            WHERE l.b_id = $1 AND l.u_id = $2`,
						[blogId, userId],
					);
					break;
				case 1:
					vote = 2;
					await client.query(
						`UPDATE likedposts
                            SET vote = 1 
                            WHERE b_id = $1 AND u_id = $2`,
						[blogId, userId],
					);
					break;
				case -1:
					vote = -2;
					await client.query(
						`UPDATE likedposts
                            SET vote = -1 
                            WHERE b_id = $1 AND u_id = $2`,
						[blogId, userId],
					);
					break;
				default:
					errorLogger.error(
						'Failed to vote resource: Invalid vote input',
					);
					return res.status(500).json({
						success: false,
						status: 'error',
						message: 'Failed to vote resource.',
					});
			}
		} else {
			await client.query(
				`INSERT INTO 
                    likedposts (b_id, u_id, vote) 
                    VALUES ($1, $2, $3)`,
				[blogId, userId, vote],
			);
		}
		await client.query(
			`UPDATE blogs 
			SET votes = votes + $1 WHERE b_id = $2`,
			[vote, blogId],
		);
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		errorLogger.error('Failed to vote blog: ' + e);
		return res.status(500).json({
			success: false,
			status: 'error',
			message: 'Failed to vote blog.',
		});
	} finally {
		client.release();
	}
	res.json({ success: true });
};

const deleteBlog = async (req, res) => {
	//TODO
};

exports.getBlogs = getBlogs;
exports.getBlogById = getBlogById;
exports.getBlogsByUserId = getBlogsByUserId;
exports.createBlog = createBlog;
exports.voteBlog = voteBlog;
