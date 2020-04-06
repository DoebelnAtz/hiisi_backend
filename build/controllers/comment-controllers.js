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
const queries_1 = __importDefault(require("../postgres/queries"));
exports.getCommentThreadById = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { tid } = req.params;
    let commentThread = yield queries_1.default.query(`
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
		) SELECT * FROM cmts ORDER BY comment_date ASC`, [tid]);
    commentThread = commentThread.rows;
    res.json(commentThread);
}), 'Failed to get comments');
exports.createComment = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const authorId = req.decoded.u_id;
    const { threadId, content } = req.body;
    let thread;
    thread = yield queries_1.default.query(`SELECT t_id, author 
			FROM commentthreads 
			LEFT JOIN comments 
			ON t_id = childthread WHERE t_id = $1`, [threadId]);
    if (!(thread = thread.rows[0])) {
        throw new customError_1.default('Failed to find comment with provided thread id', 404);
    }
    const client = yield queries_1.default.connect();
    let createdComment;
    try {
        yield client.query('BEGIN');
        thread = yield client.query('INSERT INTO commentthreads DEFAULT VALUES RETURNING t_id');
        thread = thread.rows[0];
        createdComment = yield client.query(`INSERT INTO comments(commentcontent, author, parentthread, childthread)
				VALUES($1, $2, $3, $4)
				RETURNING c_id, commentcontent,
			author as u_id, parentthread, childthread, comment_date`, [content, authorId, threadId, thread.t_id]);
        yield client.query('COMMIT');
    }
    catch (e) {
        yield client.query('ROLLBACK');
        throw new Error('Failed to create comment');
    }
    finally {
        client.release();
    }
    res.status(201).json(Object.assign(Object.assign({}, createdComment.rows[0]), { username: req.decoded.username, profile_pic: `https://cdn.intra.42.fr/users/medium_${req.decoded.username}.jpg` }));
}), 'Failed to create comment');
exports.deleteComment = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { commentId } = req.body;
    let commentToDelete = yield queries_1.default.query(`
		SELECT c_id, author FROM comments WHERE c_id = $1
	`, [commentId]);
    if (!commentToDelete.rows.length) {
        throw new customError_1.default(`Failed to find comment to delete with provided comment id`, 404);
    }
    else {
        commentToDelete = commentToDelete.rows;
        commentToDelete = commentToDelete[0];
    }
    if (commentToDelete.author !== req.decoded.u_id) {
        throw new customError_1.default('Unauthorized comment deletion', 403);
    }
    const client = yield queries_1.default.connect();
    try {
        yield client.query('BEGIN');
        yield client.query(`
			UPDATE comments SET author = null, commentcontent = 'deleted' WHERE c_id = $1 
		`, [commentId]);
        yield client.query('COMMIT');
    }
    catch (e) {
        yield client.query('ROLLBACK');
        throw Error;
    }
    finally {
        client.release();
    }
    res.json({ success: true });
}), 'Failed to delete comment');
//# sourceMappingURL=comment-controllers.js.map