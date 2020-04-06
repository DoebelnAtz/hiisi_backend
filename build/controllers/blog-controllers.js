"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const catchErrors_1 = require("../errors/catchErrors");
const customError_1 = __importDefault(require("../errors/customError"));
const transaction_1 = require("../errors/transaction");
const queries_1 = __importDefault(require("../postgres/queries"));
const { errorLogger } = require('../logger');
exports.getBlogs = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const senderId = req.decoded.u_id;
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
        blogs = yield queries_1.default.query(query, [
            userId,
            perPage,
            (pagination - 1) * perPage,
        ]);
        blogs = blogs.rows;
        blogs.map((blog) => (blog.owner = blog.u_id === senderId));
    }
    catch (e) {
        errorLogger.error(`'Failed to get blogs: ${e} ${query}`);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get blogs',
        });
    }
    res.json(blogs);
}), 'Failed to get blogs');
exports.getBlogById = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const blogId = req.params.bid;
    let blog;
    blog = yield queries_1.default.query(`SELECT b.title, b.content, b.edited,
		b.b_id, b.commentthread, b.published_date, 
		u.username, u.u_id, u.profile_pic
		FROM blogs b JOIN users u ON u.u_id = author WHERE b_id = $1`, [blogId]);
    blog = blog.rows[0];
    blog.owner = blog.u_id === req.decoded.u_id;
    res.json(blog);
}), 'Failed to get post by id');
exports.getBlogsByUserId = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.params.uid;
    let blogs;
    try {
        blogs = yield queries_1.default.query('SELECT * FROM blogs WHERE author = $1', [
            userId,
        ]);
        blogs = blogs.rows;
    }
    catch (e) {
        errorLogger.error(`Failed to get blog by user id: ${e}`);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get post by user id',
        });
    }
    res.json(blogs);
}), 'Failed to get posts by user id');
exports.createBlog = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { title, content } = req.body;
    const authorId = req.decoded.u_id;
    const client = yield queries_1.default.connect();
    let createdBlog;
    try {
        yield client.query('BEGIN');
        let res = yield client.query(`INSERT INTO commentthreads
			DEFAULT VALUES RETURNING t_id`);
        res = res.rows[0];
        createdBlog = yield client.query(`INSERT INTO blogs(title, content, author, commentthread)
				VALUES($1, $2, $3, $4) 
				RETURNING b_id, title, content, author, commentthread, votes, published_date`, [title, content, authorId, res.t_id]);
        yield client.query('COMMIT');
    }
    catch (e) {
        yield client.query('ROLLBACK');
        if (e.code === '23505') {
            throw new customError_1.default('Title already exists', 400);
        }
        else {
            throw new Error('Failed to create post');
        }
    }
    finally {
        client.release();
    }
    res.status(201).json(createdBlog.rows[0]);
}), 'Failed to create post');
exports.voteBlog = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let { vote, blogId } = req.body;
    const userId = req.decoded.u_id;
    let voteTarget = yield queries_1.default.query(`SELECT l.b_id, l.vote 
			FROM blogvotes l 
			WHERE l.b_id = $1 AND l.u_id = $2`, [blogId, userId]);
    voteTarget = voteTarget.rows[0];
    const client = yield queries_1.default.connect();
    yield transaction_1.transaction(() => __awaiter(void 0, void 0, void 0, function* () {
        if (!!voteTarget) {
            switch (vote) {
                case 0:
                    vote = -voteTarget.vote;
                    yield client.query(`DELETE FROM blogvotes WHERE b_id = $1 AND u_id = $2`, [blogId, userId]);
                    break;
                case 1:
                    vote = 2;
                    yield client.query(`UPDATE blogvotes
                            SET vote = 1 
                            WHERE b_id = $1 AND u_id = $2`, [blogId, userId]);
                    break;
                case -1:
                    vote = -2;
                    yield client.query(`UPDATE blogvotes
                            SET vote = -1 
                            WHERE b_id = $1 AND u_id = $2`, [blogId, userId]);
                    break;
                default:
                    errorLogger.error('Failed to vote blog: Invalid vote input');
                    return res.status(500).json({
                        success: false,
                        status: 'error',
                        message: 'Failed to vote blog.',
                    });
            }
        }
        else {
            yield client.query(`INSERT INTO 
                    blogvotes (b_id, u_id, vote) 
                    VALUES ($1, $2, $3)`, [blogId, userId, vote]);
        }
    }), client, 'Failed to vote on post');
    res.json({ success: true });
}), 'Failed to vote on post');
exports.updateBlog = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { content, title, postId } = req.body;
    const senderId = req.decoded.u_id;
    let updatedBlog = yield queries_1.default.query(`UPDATE blogs
		SET
		title = $1,
		content = $2,
		edited = NOW()
		WHERE b_id = $3 AND author = $4`, [title, content, postId, senderId]);
    updatedBlog = updatedBlog.rows[0];
    res.json(updatedBlog);
}), 'Failed to update post');
exports.deleteBlog = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const senderId = req.decoded.u_id;
    const { blogId } = req.body;
    let blogToDelete = yield queries_1.default.query(`SELECT b_id, commentthread FROM blogs WHERE b_id = $1 AND author = $2`, [blogId, senderId]);
    if (blogToDelete.rows.length !== 1) {
        throw new customError_1.default('Failed to find post with provided id', 404);
    }
    blogToDelete = blogToDelete.rows[0];
    const client = yield queries_1.default.connect();
    yield transaction_1.transaction(() => __awaiter(void 0, void 0, void 0, function* () {
        yield client.query(`DELETE FROM blogvotes WHERE b_id = $1`, [
            blogId,
        ]);
        yield client.query(`DELETE FROM blogs WHERE b_id = $1`, [blogId]);
        yield client.query(`
			DELETE FROM commentthreads WHERE t_id = $1`, [blogToDelete.commentthread]);
    }), client, 'Failed to delete post');
    res.json({ success: true });
}), 'Failed to delete post');
//# sourceMappingURL=blog-controllers.js.map