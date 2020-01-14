const { validationResult } = require('express-validator');

const db = require('../queries');



const getBlogs = async (req, res) => {

    let sender;

    const { senderId } = req.body;

    try {
        sender = await db.query('SELECT blog_id FROM users join likedposts ON likedposts.user_id = $1', [senderId]);
        sender = sender.rows.map(row => row.blog_id);
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get blogs'
        })
    }

    let blogs;
    try {
        blogs = await db.query(
            'SELECT b_id, content, title, published_date, commentthread, u_id, username FROM blogs JOIN users ON blogs.author = users.u_id'
        );
        blogs = blogs.rows;
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get blogs'
        })
    }

    res.json(

            blogs.map(blog => {
                return (
                    {
                        ...blog,
                        liked: (sender ? sender.includes(blog.b_id) : false)
                    }
                )
            })
    );
};



const getBlogById = async (req, res) => {
    const blogId = req.params.bid;

    let blog;
    try {
        blog = await db.query("SELECT * FROM blogs WHERE b_id = $1", [blogId]);
        blog = blog.rows[0]
    } catch (e) {
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get blog'
        })
    }

    res.json( {blog: blog} )
};



const getBlogsByUserId = async (req, res) => {

    const userId = req.params.uid;

    let userWithBlogs;
    try {
        userWithBlogs = await db.query('SELECT * FROM blogs WHERE author = $1', [userId]);
        userWithBlogs = userWithBlogs.rows;
    } catch (e) {
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get blog by user id'
        })
    }

    res.json({ blogs: userWithBlogs.map(blog => blog)})
};



const createBlog = async (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(401).json({
            status: 'error',
            message: 'Invalid input please try again.'
        })
    }

    const { title, authorId, content } = req.body;

    let user;
    try {
        user = await db.query('SELECT username, intraid FROM users WHERE u_id = $1', [authorId]);
        user = user.rows[0]
    } catch (e) {
        console.log(e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to create blog, please try again later'
        })
    }
    if (!user) {
        return res.status(404).json({
            status: 'error',
            message: 'Could not find user with provided id'
        })
    }

    const client = await db.connect();

    let createdBlog;
    try{
        await client.query('BEGIN');
        let res = await client.query('INSERT INTO commentthreads DEFAULT VALUES RETURNING t_id');
        res = res.rows[0];
        createdBlog = await client.query(
            'INSERT INTO blogs(title, content, author, commentthread) VALUES($1, $2, $3, $4) RETURNING b_id, title, content, author, commentthread',
            [
                title,
                content,
                authorId,
                res.t_id
            ]
        );
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        console.log(e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to create blogpost, please try again later.'
        })
    } finally {
        client.release();
    }

    res.status(201).json({blog: createdBlog.rows[0]})
};

exports.getBlogs = getBlogs;
exports.getBlogById = getBlogById;
exports.getBlogsByUserId = getBlogsByUserId;
exports.createBlog = createBlog;