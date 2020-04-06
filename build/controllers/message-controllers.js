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
exports.getMessagesByThreadId = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const threadId = req.params.tid;
    const page = req.query.page;
    let isAllowed = yield queries_1.default.query(`SELECT thread_name from threadconnections JOIN threads
				ON thread_id = t_id
				WHERE user_id = $1 AND thread_id = $2`, [req.decoded.u_id, threadId]);
    if (!isAllowed.rows.length) {
        throw new customError_1.default('Failed to get messages: unauthorized', 401);
    }
    let messages = yield queries_1.default.query(`SELECT * FROM 
			(SELECT username, u_id, profile_pic, m.m_id, m.message, m.time_sent 
				FROM messages m JOIN threads t ON  t.t_id = m.thread
            	LEFT JOIN users on users.u_id = m.sender 
            WHERE m.thread = $1 
            ORDER BY m.time_sent DESC LIMIT $2 OFFSET $3) 
            AS mes ORDER BY mes.time_sent ASC`, [threadId, 20, (page - 1) * 20]);
    messages = messages.rows;
    yield queries_1.default.query(`UPDATE online_users SET last_updated = NOW() WHERE u_id = $1 RETURNING u_id`, [req.decoded.u_id]);
    res.json({ title: isAllowed.rows[0].thread_name, messages });
}), 'Failed to get messages');
exports.getUsersInThread = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const threadId = req.params.tid;
    let users = yield queries_1.default.query('SELECT thread_id, username, profile_pic, u_id FROM users ' +
        'JOIN threadconnections ON user_id = u_id WHERE thread_id = $1', [threadId]);
    users = users.rows;
    res.json(users);
}), 'Failed to get users connected to thread');
exports.getThreadsByUserId = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.decoded.u_id;
    let threads = yield queries_1.default.query(`SELECT thread_name, user_id, username, u_id, profile_pic, thread_id, project_thread
				FROM users JOIN threadconnections 
				ON user_id = u_id 
				JOIN threads ON t_id = thread_id 
				WHERE users.u_id = $1`, [userId]);
    threads = threads.rows;
    yield queries_1.default.query(`UPDATE online_users SET last_updated = NOW() WHERE u_id = $1 RETURNING u_id`, [req.decoded.u_id]);
    res.json(threads);
}), 'Failed to get messages');
exports.createNewThread = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.decoded.u_id;
    const { threadName } = req.body;
    const client = yield queries_1.default.connect();
    let createdThread;
    try {
        yield client.query('BEGIN');
        createdThread = yield client.query(`INSERT INTO threads (thread_name) 
				VALUES ($1) RETURNING t_id AS thread_id, thread_name`, [threadName]);
        createdThread = createdThread.rows[0];
        yield client.query('INSERT INTO threadconnections (user_id, thread_id) ' +
            'VALUES ($1, $2)', [userId, createdThread.thread_id]);
        yield client.query('COMMIT');
    }
    catch (e) {
        yield client.query('ROLLBACK');
        throw new Error('Failed to create thread');
    }
    finally {
        client.release();
    }
    console.log(createdThread);
    res.status(201).json(createdThread);
}), 'Failed to create thread');
exports.addUserToThread = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const senderId = req.decoded.u_id;
    const { targetId, threadId } = req.body;
    let checkSenderIsInThread = yield queries_1.default.query(`SELECT * FROM threadconnections WHERE user_id = $1 
				AND thread_id = $2`, [senderId, threadId]);
    if (!checkSenderIsInThread.rows.length) {
        throw new customError_1.default('Unauthorized sender', 401);
    }
    let addedUser;
    yield queries_1.default.query('INSERT INTO threadconnections (thread_id, user_id) ' +
        'VALUES ($1, $2)', [threadId, targetId]);
    addedUser = yield queries_1.default.query('SELECT username, profile_pic, u_id FROM users ' + 'WHERE u_id = $1', [targetId]);
    addedUser = addedUser.rows[0];
    res.json(addedUser);
}), 'Failed to add User to thread');
exports.deleteThread = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const senderId = req.decoded.u_id;
    const { targetId } = req.body;
    let fullDelete = false;
    let deleteTarget = yield queries_1.default.query(`SELECT thread_id, user_id FROM threads JOIN threadconnections 
	        ON thread_id = t_id 
	        WHERE thread_id = $1`, [targetId]);
    deleteTarget = deleteTarget.rows;
    if (!deleteTarget.length) {
        throw new customError_1.default('Failed to find thread with provided id', 404);
    }
    else if (!deleteTarget.find((thread) => thread.user_id === senderId)) {
        throw new customError_1.default('Unauthorized sender', 401);
    }
    if (deleteTarget.length === 1) {
        fullDelete = true;
    }
    const client = yield queries_1.default.connect();
    try {
        yield client.query('BEGIN');
        yield client.query(`
				DELETE FROM threadconnections WHERE thread_id = $1 AND user_id = $2
			`, [targetId, senderId]);
        if (fullDelete) {
            yield client.query(`
				DELETE FROM messages WHERE thread = $1
			`, [targetId]);
            yield client.query(`
				DELETE FROM threads WHERE t_id = $1
			`, [targetId]);
        }
        yield client.query('COMMIT');
    }
    catch (e) {
        yield client.query('ROLLBACK');
        console.log(e);
        throw new Error('Failed to delete thread');
    }
    finally {
        client.release();
    }
    res.json({ success: true });
}), 'Failed to delete thread');
//# sourceMappingURL=message-controllers.js.map