const { validationResult } = require('express-validator');

const db = require('../queries');

const getCommentThreadById = async (req, res, next) => {
    const { tid } = req.params;

    let commentThread;
    try {
        commentThread = await db.query(
            'SELECT commentcontent, author, parentthread, childthread, username ' +
            'FROM comments JOIN users ON comments.parentthread = $1 AND comments.author = users.u_id',
            [tid]
        );
        commentThread = commentThread.rows;
    } catch (e) {
        return res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve comments.'
        })
    }
    res.json({ comments: commentThread.map(comment => comment)})
};

const createComment = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(401).json({
            status: 'error',
            message: 'Invalid inputs passed, please check your data.'
        })
    }

    const { threadId, content, authorId } = req.body;

    let thread;
    try {
        thread = await db.query('SELECT * FROM commentthreads WHERE t_id = $1', [threadId])
        if (!(thread = thread.rows[0]))
            return res.status(401).json({
                status: 'error',
                message: 'Failed to find comment thread with the given thread id'
            })
    } catch (e) {
        return res.status(500).json({
            status: 'error',
            message: 'Failed to create comment, please try again later'
        })
    }

    let commentAuthor;
    try {
        commentAuthor = await db.query('SELECT username, intraid FROM users WHERE u_id = $1', [authorId]);
        if (!(commentAuthor = commentAuthor.rows[0]))
            return res.status(401).json({
                status: 'error',
                message: 'Failed to find user with the given user id'
            })
    } catch (e) {
        return res.status(500).json({
            status: 'error',
            message: 'Failed to create comment, please try again later'
        })
    }

    const client = await db.connect();
    let createdComment;
    try{
        await client.query('BEGIN');
        let res = await client.query('INSERT INTO commentthreads DEFAULT VALUES RETURNING t_id');
        res = res.rows[0];
        createdComment = await client.query(
            'INSERT INTO comments(commentcontent, author, parentthread, childthread) VALUES($1, $2, $3, $4) RETURNING c_id, commentcontent, author, parentthread, childthread',
            [
                content,
                authorId,
                threadId,
                res.t_id
            ]
        );
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        console.log(e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to create comment, please try again later.'
        })
    } finally {
        client.release();
    }
    res.status(201).json({
        comment: { ...createdComment.rows[0], author: commentAuthor }
    })
};
exports.getCommentThreadById = getCommentThreadById;
exports.createComment = createComment;