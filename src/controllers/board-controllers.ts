import { catchErrors } from '../errors/catchErrors';
import db from '../postgres/queries';

export const updateColumn = catchErrors(async (req, res) => {
	const { title, columnId, wipLimit } = req.body;
	let newTitle = await db.query(
		`UPDATE boardcolumns SET title = $1, wip_limit = $2 
            WHERE column_id = $3
            RETURNING title`,
		[title, wipLimit, columnId],
	);

	res.json({ title: newTitle.rows[0].title });
}, 'Failed to update column title');

export const updateTaskPosition = catchErrors(async (req, res) => {
	const updatedTask = req.body;
	await db.query('UPDATE tasks SET column_id = $1 WHERE task_id = $2', [
		updatedTask.column_id,
		updatedTask.task_id,
	]);
	res.json({ success: true });
}, 'Failed to update Task position');

export const updateTask = catchErrors(async (req, res) => {
	const updatedTask = req.body;

	await db.query(
		`UPDATE tasks
				SET title = $1, column_id = $2,
				description = $3, priority = $4,
				status = $5, color_tag = $6
				WHERE task_id = $7`,
		[
			updatedTask.title,
			updatedTask.column_id,
			updatedTask.description,
			Number(updatedTask.priority),
			updatedTask.status,
			updatedTask.color_tag,
			updatedTask.task_id,
		],
	);
	res.json({ success: true });
}, 'Failed to update task');

export const deleteTask = catchErrors(async (req, res) => {
	const { taskId } = req.body;

	const senderId = req.decoded.u_id;
	let targetTask = await db.query(
		`SELECT t.task_id, t.commentthread, c.u_id 
	        FROM tasks t JOIN taskcollaborators c 
	        ON c.task_id = t.task_id
	        WHERE t.task_id = $1 AND c.u_id = $2`,
		[taskId, senderId],
	);

	const client = await db.connect();

	try {
		await client.query('BEGIN');
		await client.query(`DELETE FROM taskcollaborators WHERE task_id = $1`, [
			taskId,
		]);
		await client.query(
			`
            DELETE FROM tasks WHERE task_id = $1
        `,
			[taskId],
		);
		if (targetTask.rows[0].commentthread) {
			await client.query(
				`
                DELETE FROM commentthreads WHERE t_id = $1
            `,
				[targetTask.rows[0].commentthread],
			);
		}
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		throw new Error('Failed to delete task');
	} finally {
		client.release();
	}
	res.json({ success: true });
}, 'Failed to delete task');

export const getTaskById = catchErrors(async (req, res) => {
	const userId = req.decoded.u_id;
	const taskId = req.params.tid;
	let task = await db.query(
		`SELECT t.priority, t.description, t.commentthread, 
		t.status, t.color_tag, t.task_id, t.title, t.column_id FROM tasks t
		WHERE t.task_id = $1`,
		[taskId],
	);

	let collaborators = await db.query(
		'SELECT u.username, u.profile_pic, u.u_id ' +
			'FROM users u JOIN taskcollaborators c ON c.u_id = u.u_id ' +
			'WHERE c.task_id = $1',
		[taskId],
	);
	task = {
		...task.rows[0],
		collaborators: collaborators.rows,
		owner:
			!!collaborators.rows.find((col: any) => col.u_id === userId) ||
			!collaborators.rows.length,
	};

	res.json(task);
}, 'Failed to get task');

export const addCollaboratorToTask = catchErrors(async (req, res) => {
	const { userId, taskId } = req.body;

	await db.query(
		'INSERT INTO taskcollaborators (u_id, task_id) VALUES ($1, $2)',
		[userId, taskId],
	);

	let collaborators = await db.query(
		`SELECT t.task_id, u.username, u.profile_pic, u.u_id FROM tasks t 
				JOIN taskcollaborators c ON c.task_id = t.task_id 
				JOIN users u ON c.u_id = u.u_id 
				WHERE t.task_id = $1`,
		[taskId],
	);

	res.status(201).json({ collaborators: collaborators.rows });
}, 'Failed to add collaborator to task');

export const removeCollaboratorFromTask = catchErrors(async (req, res) => {
	const { userId, taskId } = req.body;

	await db.query(
		`DELETE FROM taskcollaborators WHERE task_id = $1 AND u_id = $2`,
		[taskId, userId],
	);

	res.json({ success: true });
}, 'Failed to remove collaborator from task');

export const getBoardById = catchErrors(async (req, res) => {
	const boardId = req.params.bid;
	let board: any;

	board = await db.query(
		`SELECT 
            u.username, u.profile_pic, u.u_id, 
            c.title, c.column_id, c.wip_limit, 
            b.board_id, 
            t.priority, t.title AS task_title, t.task_id, t.description, t.status, t.color_tag 
            FROM boards b 
            JOIN boardcolumns c 
            ON b.board_id = c.board_id 
            LEFT JOIN tasks t ON t.column_id = c.column_id 
            LEFT JOIN taskcollaborators tc ON tc.task_id = t.task_id 
            LEFT JOIN users u ON u.u_id = tc.u_id WHERE b.board_id = $1 ORDER BY c.column_id ASC, task_title ASC`,
		[boardId],
	);
	board = board.rows;

	let columns: any = [];
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
}, 'Failed to get board by id');

export const addTaskToBoard = catchErrors(async (req, res) => {
	const userId = req.decoded.u_id;

	const { taskTitle, taskColumnId } = req.body;

	const client = await db.connect();
	let createdTask;
	try {
		await client.query('BEGIN');
		let commentThread = await client.query(`
			INSERT INTO commentthreads DEFAULT VALUES RETURNING *
		`);
		createdTask = await client.query(
			`INSERT INTO 
			tasks (title, column_id, commentthread) 
			VALUES ($1, $2, $3)
			RETURNING task_id, title, priority, description, status`,
			[taskTitle, taskColumnId, commentThread.rows[0].t_id],
		);
		createdTask = createdTask.rows[0];
		await client.query(
			'INSERT INTO taskcollaborators (task_id, u_id) VALUES ($1, $2)',
			[createdTask.task_id, userId],
		);
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		throw new Error('Failed to add task to board');
	} finally {
		client.release();
	}

	let collaborators = await db.query(
		`SELECT t.task_id, u.username, u.profile_pic, u.u_id FROM tasks t 
			JOIN taskcollaborators c ON c.task_id = t.task_id 
			JOIN users u ON c.u_id = u.u_id 
			WHERE t.task_id = $1`,
		[createdTask.task_id],
	);

	res.status(201).json({ ...createdTask, collaborators: collaborators.rows });
}, 'Failed to add task to board');
