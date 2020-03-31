const { validationResult } = require('express-validator');
const { errorLogger } = require('../logger');
const db = require('../postgres/queries');

const getBlogs = async (req, res) => {
	let sender;
	const senderId = req.decoded.u_id; // get sender id from decoded token
	let order = req.query.order || 'popular';
	let pagination = req.query.page || 1;
	let reverse = req.query.reverse || 'false';
	if (order !== 'popular' && order !== 'recent' && order !== 'title') {
		errorLogger.error(
			`Failed to get ${posts.tableName}: invalid order parameter`,
		);
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
            JOIN blogvotes ON blogvotes.u_id = $1`,
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
		blogs.map((blog) => (blog.owner = blog.u_id === senderId));
	} catch (e) {
		errorLogger.error(`'Failed to get blogs: ${e} ${query}`);
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
			`SELECT b.title, b.content, b.edited,
			b.b_id, b.commentthread, b.published_date, 
			u.username, u.u_id, u.profile_pic
			FROM blogs b JOIN users u ON u.u_id = author WHERE b_id = $1`,
			[blogId],
		);
		blog = blog.rows[0];
		blog.owner = blog.u_id === req.decoded.u_id;
	} catch (e) {
		errorLogger.error(`Failed to get blog: ${e}`);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to get blog',
		});
	}

	res.json(blog);
};

const getBlogsByUserId = async (req, res) => {
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
};

const createBlog = async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(400).json({
			status: 'error',
			message: 'Invalid input please try again.',
		});
	}

	const { title, authorId, content } = req.body;

	let user;
	try {
		user = await db.query(
			'SELECT username, intraid FROM users WHERE u_id = $1',
			[authorId],
		);
		user = user.rows[0];
	} catch (e) {
		errorLogger.error(`Failed to create blog: ${e}`);
		if (e.code === '23505') {
			res.status(400).json({
				success: false,
				status: 'error',
				message: 'Title already exists',
			});
		} else {
			return res.status(500).json({
				success: false,
				status: 'error',
				message: 'Failed to create post.',
			});
		}
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
			`INSERT INTO blogs(title, content, author, commentthread)
				VALUES($1, $2, $3, $4) 
				RETURNING b_id, title, content, author, commentthread, votes, published_date`,
			[title, content, authorId, res.t_id],
		);
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		errorLogger.error(`Failed to create blog: ${e}`);
		if (e.code === '23505') {
			res.status(400).json({
				success: false,
				status: 'error',
				message: 'Title already exists',
			});
		} else {
			return res.status(500).json({
				success: false,
				status: 'error',
				message: 'Failed to add Resource to DB.',
			});
		}
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
			`SELECT l.b_id, l.vote 
			FROM blogvotes l 
			WHERE l.b_id = $1 AND l.u_id = $2`,
			[blogId, userId],
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
					console.log(blogId, userId);
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

const updateBlog = async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(400).json({
			status: 'error',
			message: 'Invalid input please try again.',
		});
	}

	const { content, title, postId } = req.body;
	const senderId = req.decoded.u_id;
	let updatedBlog;
	try {
		updatedBlog = await db.query(
			`UPDATE blogs
	        SET
	        title = $1,
	        content = $2,
	        edited = NOW()
	        WHERE b_id = $3 AND author = $4`,
			[title, content, postId, senderId],
		);
		updatedBlog = updatedBlog.rows[0];
	} catch (e) {
		errorLogger.error(`Failed to update blog: ${e}`);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to update blog',
		});
	}
	res.json(updatedBlog);
};

const deleteBlog = async (req, res) => {
	const senderId = req.decoded.u_id;

	const { blogId } = req.body;
	let blogToDelete;
	try {
		blogToDelete = await db.query(
			`SELECT b_id, commentthread FROM blogs WHERE b_id = $1`,
			[blogId],
		);
		blogToDelete = blogToDelete.rows[0];
	} catch (e) {
		errorLogger.error('Failed to find post to delete: ' + e);
		return res.status(500).json({
			success: false,
			status: 'error',
			message: 'Failed to find post to delete.',
		});
	}
	const client = await db.connect();

	try {
		await client.query('BEGIN');

		await client.query(`DELETE FROM blogvotes WHERE b_id = $1`, [blogId]);

		await client.query(`DELETE FROM blogs WHERE b_id = $1`, [blogId]);
		await client.query(
			`
			DELETE FROM commentthreads WHERE t_id = $1`,
			[blogToDelete.commentthread],
		);
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		errorLogger.error('Failed to add task: ' + e);
		return res.status(500).json({
			success: false,
			status: 'error',
			message: 'Failed to find post to delete.',
		});
	} finally {
		client.release();
	}
	res.json({ success: true });
};

module.exports = {
	getBlogs,
	getBlogById,
	getBlogsByUserId,
	updateBlog,
	createBlog,
	voteBlog,
	deleteBlog,
};
