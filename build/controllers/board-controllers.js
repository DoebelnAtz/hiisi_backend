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
const queries_1 = __importDefault(require("../postgres/queries"));
exports.updateColumn = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { title, columnId, wipLimit } = req.body;
    let newTitle = yield queries_1.default.query(`UPDATE boardcolumns SET title = $1, wip_limit = $2 
            WHERE column_id = $3
            RETURNING title`, [title, wipLimit, columnId]);
    newTitle = newTitle.rows[0];
    res.json({ title: newTitle.title });
}), 'Failed to update column title');
exports.updateTaskPosition = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const updatedTask = req.body;
    yield queries_1.default.query('UPDATE tasks SET column_id = $1 WHERE task_id = $2', [
        updatedTask.column_id,
        updatedTask.task_id,
    ]);
    res.json({ success: true });
}), 'Failed to update Task position');
exports.updateTask = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const updatedTask = req.body;
    yield queries_1.default.query(`UPDATE tasks
				SET title = $1, column_id = $2,
				description = $3, priority = $4,
				status = $5, color_tag = $6
				WHERE task_id = $7`, [
        updatedTask.title,
        updatedTask.column_id,
        updatedTask.description,
        Number(updatedTask.priority),
        updatedTask.status,
        updatedTask.color_tag,
        updatedTask.task_id,
    ]);
    res.json({ success: true });
}), 'Failed to update task');
exports.deleteTask = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { taskId } = req.body;
    const senderId = req.decoded.u_id;
    let targetTask = yield queries_1.default.query(`SELECT t.task_id, t.commentthread, c.u_id 
	        FROM tasks t JOIN taskcollaborators c 
	        ON c.task_id = t.task_id
	        WHERE t.task_id = $1 AND c.u_id = $2`, [taskId, senderId]);
    targetTask = targetTask.rows[0];
    const client = yield queries_1.default.connect();
    try {
        yield client.query('BEGIN');
        yield client.query(`DELETE FROM taskcollaborators WHERE task_id = $1`, [
            taskId,
        ]);
        yield client.query(`
            DELETE FROM tasks WHERE task_id = $1
        `, [taskId]);
        if (targetTask.commentthread) {
            yield client.query(`
                DELETE FROM commentthreads WHERE t_id = $1
            `, [targetTask.commentthread]);
        }
        yield client.query('COMMIT');
    }
    catch (e) {
        yield client.query('ROLLBACK');
        throw new Error('Failed to delete task');
    }
    finally {
        client.release();
    }
    res.json({ success: true });
}), 'Failed to delete task');
exports.getTaskById = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.decoded.u_id;
    const taskId = req.params.tid;
    let task = yield queries_1.default.query(`SELECT t.priority, t.description, t.commentthread, 
		t.status, t.color_tag, t.task_id, t.title, t.column_id FROM tasks t
		WHERE t.task_id = $1`, [taskId]);
    let collaborators = yield queries_1.default.query('SELECT u.username, u.profile_pic, u.u_id ' +
        'FROM users u JOIN taskcollaborators c ON c.u_id = u.u_id ' +
        'WHERE c.task_id = $1', [taskId]);
    task = Object.assign(Object.assign({}, task.rows[0]), { collaborators: collaborators.rows, owner: !!collaborators.rows.find((col) => col.u_id === userId) ||
            !collaborators.rows.length });
    res.json(task);
}), 'Failed to get task');
exports.addCollaboratorToTask = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, taskId } = req.body;
    yield queries_1.default.query('INSERT INTO taskcollaborators (u_id, task_id) VALUES ($1, $2)', [userId, taskId]);
    let collaborators = yield queries_1.default.query(`SELECT t.task_id, u.username, u.profile_pic, u.u_id FROM tasks t 
				JOIN taskcollaborators c ON c.task_id = t.task_id 
				JOIN users u ON c.u_id = u.u_id 
				WHERE t.task_id = $1`, [taskId]);
    collaborators = collaborators.rows;
    res.status(201).json({ collaborators });
}), 'Failed to add collaborator to task');
exports.removeCollaboratorFromTask = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, taskId } = req.body;
    yield queries_1.default.query(`DELETE FROM taskcollaborators WHERE task_id = $1 AND u_id = $2`, [taskId, userId]);
    res.json({ success: true });
}), 'Failed to remove collaborator from task');
exports.getBoardById = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const boardId = req.params.bid;
    let board;
    board = yield queries_1.default.query(`SELECT 
            u.username, u.profile_pic, u.u_id, 
            c.title, c.column_id, c.wip_limit, 
            b.board_id, 
            t.priority, t.title AS task_title, t.task_id, t.description, t.status, t.color_tag 
            FROM boards b 
            JOIN boardcolumns c 
            ON b.board_id = c.board_id 
            LEFT JOIN tasks t ON t.column_id = c.column_id 
            LEFT JOIN taskcollaborators tc ON tc.task_id = t.task_id 
            LEFT JOIN users u ON u.u_id = tc.u_id WHERE b.board_id = $1 ORDER BY c.column_id ASC, task_title ASC`, [boardId]);
    board = board.rows;
    let columns = [];
    let prevCol = 0;
    let taskIndex = -1;
    let colIndex = -1;
    let prevTask = 0;
    for (let i = 0; i < board.length; i++) {
        if (board[i].column_id !== prevCol) {
            colIndex++;
            columns.push({
                title: board[i].title,
                column_id: board[i].column_id,
                column_number: colIndex,
                wip_limit: board[i].wip_limit,
                tasks: [],
            });
            taskIndex = -1;
        }
        if (board[i].task_id !== prevTask && !!board[i].task_id) {
            taskIndex++;
            columns[colIndex].tasks.push({
                title: board[i].task_title,
                task_id: board[i].task_id,
                color_tag: board[i].color_tag,
                status: board[i].status,
                priority: board[i].priority,
                collaborators: [],
            });
        }
        if (!!board[i].u_id) {
            columns[colIndex].tasks[taskIndex].collaborators.push({
                u_id: board[i].u_id,
                username: board[i].username,
                profile_pic: board[i].profile_pic,
            });
        }
        prevTask = board[i].task_id;
        prevCol = board[i].column_id;
    }
    board = { columns };
    res.json(board);
}), 'Failed to get board by id');
exports.addTaskToBoard = catchErrors_1.catchErrors((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.decoded.u_id;
    const { taskTitle, taskColumnId } = req.body;
    const client = yield queries_1.default.connect();
    let createdTask;
    try {
        yield client.query('BEGIN');
        let commentThread = yield client.query(`
			INSERT INTO commentthreads DEFAULT VALUES RETURNING *
		`);
        createdTask = yield client.query(`INSERT INTO 
			tasks (title, column_id, commentthread) 
			VALUES ($1, $2, $3)
			RETURNING task_id, title, priority, description, status`, [taskTitle, taskColumnId, commentThread.rows[0].t_id]);
        createdTask = createdTask.rows[0];
        yield client.query('INSERT INTO taskcollaborators (task_id, u_id) VALUES ($1, $2)', [createdTask.task_id, userId]);
        yield client.query('COMMIT');
    }
    catch (e) {
        yield client.query('ROLLBACK');
        throw new Error('Failed to add task to board');
    }
    finally {
        client.release();
    }
    let collaborators = yield queries_1.default.query(`SELECT t.task_id, u.username, u.profile_pic, u.u_id FROM tasks t 
			JOIN taskcollaborators c ON c.task_id = t.task_id 
			JOIN users u ON c.u_id = u.u_id 
			WHERE t.task_id = $1`, [createdTask.task_id]);
    collaborators = collaborators.rows;
    res.status(201).json(Object.assign(Object.assign({}, createdTask), { collaborators: collaborators }));
}), 'Failed to add task to board');
//# sourceMappingURL=board-controllers.js.map