import { catchErrors } from '../errors/catchErrors';
import CustomError from '../errors/customError';

const { validationResult } = require('express-validator');
const { errorLogger } = require('../logger');
const db = require('../postgres/queries');

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
	collaborators = collaborators.rows;

	res.status(201).json({ ...createdTask, collaborators: collaborators });
}, 'Failed to add task to board');

export const createProject = catchErrors(async (req, res) => {
	const userId = req.decoded.u_id;
	const { title, link, description, private: privateProject } = req.body;

	let createdProject;
	const client = await db.connect();
	try {
		await client.query('BEGIN');
		let commentthread = await client.query(
			`INSERT INTO commentthreads DEFAULT VALUES 
			RETURNING t_id`,
		);
		commentthread = commentthread.rows[0];
		let chatthread = await client.query(
			`INSERT INTO 
			threads (thread_name, project_thread)
			 VALUES ($1, true) 
			RETURNING t_id`,
			[title],
		);
		chatthread = chatthread.rows[0];
		createdProject = await client.query(
			`INSERT INTO projects 
			(title, description, link, t_id, commentthread, creator, private) 
			VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
			[
				title,
				description,
				link,
				chatthread.t_id,
				commentthread.t_id,
				userId,
				privateProject,
			],
		);
		createdProject = createdProject.rows[0];
		let board = await client.query(
			`INSERT INTO boards (title, project_id) 
			VALUES ($1, $2) RETURNING board_id`,
			[title, createdProject.project_id],
		);
		board = board.rows[0];
		let boardTitles = [
			'Backlog',
			'Breakdown',
			'In Development',
			'Testing',
			'Implementing',
		];

		for (var i = 0; i < 5; i++) {
			await client.query(
				`INSERT INTO boardcolumns 
				(board_id, title, wip_limit) VALUES 
				($1, $2, ${!i ? null : 2})`,
				[board.board_id, boardTitles[i]],
			);
		}
		await client.query(
			`INSERT INTO projectcollaborators 
			(u_id, project_id) VALUES ($1, $2) RETURNING
			project_id, u_id`,
			[userId, createdProject.project_id],
		);
		await client.query(
			`INSERT INTO threadconnections 
			(user_id, thread_id) VALUES ($1, $2)`,
			[userId, chatthread.t_id],
		);
		let collaborators = await client.query(
			`SELECT u.username, u.profile_pic, u.u_id
			FROM users u JOIN projectcollaborators c ON c.u_id = u.u_id 
			WHERE c.project_id = $1`,
			[createdProject.project_id],
		);
		collaborators = collaborators.rows;
		createdProject = { ...createdProject, collaborators: collaborators };
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		errorLogger.error(`Failed to create project: ${e} | Err: ${e.code}`);
		if (e.code === '23505') {
			throw new CustomError(
				'Failed to create project: Title already exists',
				400,
			);
		}
		throw new Error('Failed to create project');
	} finally {
		client.release();
	}
	res.json(createdProject);
}, 'Failed to create project');

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
	collaborators = collaborators.rows;

	res.status(201).json({ collaborators });
}, 'Failed to add collaborator to task');

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

export const getProjects = catchErrors(async (req, res) => {
	const page = req.query.page || 1;
	const userId = req.decoded.u_id;
	const order = req.query.order || 'popular';
	const reverse = req.query.reverse || 'false';
	// we are dangerously inserting values into a query so we need to make sure that
	// the order parameter is correct
	if (order !== 'popular' && order !== 'recent' && order !== 'title') {
		errorLogger.error('Failed to get projects: invalid order parameter');
		return res.status(422).json({
			status: 'error',
			message: 'Failed to get resources',
		});
	}
	let order1;
	let order2;
	let reverseOrder;
	switch (order) {
		case 'popular':
			reverseOrder = reverse === 'true' ? 'ASC' : 'DESC';
			order1 = `votes ${reverseOrder}`;
			order2 = 'p.published_date DESC';
			break;
		case 'recent':
			reverseOrder = reverse === 'true' ? 'ASC' : 'DESC';
			order1 = `p.published_date ${reverseOrder}`;
			order2 = 'votes DESC';
			break;
		default:
			reverseOrder = reverse === 'true' ? 'DESC' : 'ASC';
			order1 = `p.title ${reverseOrder}`;
			order2 = 'p.published_date DESC';
	}
	const perPage = 14;
	let projects = await db.query(
		`SELECT p.title, p.published_date, u.username, p.creator, p.private,
			COALESCE(vs.votes, 0) AS votes, p.project_id, v.vote, collab.collaborators
			FROM projects p JOIN users u ON p.creator = u.u_id 
			LEFT JOIN (SELECT vote, project_id FROM projectvotes WHERE u_id = $1) v 
			ON v.project_id = p.project_id
			LEFT JOIN (SELECT project_id, SUM(vote) AS votes FROM projectvotes
			GROUP BY project_id) vs
			ON vs.project_Id = p.project_id 
			LEFT JOIN (
			SELECT pc.project_id, array_agg(cu.profile_pic) AS collaborators, array_agg(cu.u_id) AS auth_users 
			FROM users cu 
			JOIN projectcollaborators pc ON pc.u_id = cu.u_id GROUP BY pc.project_id
			) collab ON collab.project_id = p.project_id WHERE $1 = ANY (auth_users) OR p.private = false
			ORDER BY ${order1}, ${order2} LIMIT $2 OFFSET $3`,
		[userId, perPage, (page - 1) * perPage],
	);
	projects = projects.rows;

	res.json(projects);
}, 'Failed to get projects');

export const getProjectById = catchErrors(async (req, res) => {
	const projectId = req.params.pid;
	const userId = req.decoded.u_id;

	let contributor = false;
	let project = await db.query(
		`SELECT p.title, p.commentthread, p.creator,
				b.board_id, p.project_id, p.votes, p.t_id, p.private,
				p.description, p.link, p.published_date
				FROM projects p JOIN boards b 
				ON b.project_id = p.project_id AND p.project_id = $1`,
		[projectId],
	);
	project = project.rows[0];

	let collaborators = await db.query(
		'SELECT u.username, u.u_id, u.profile_pic FROM users u ' +
			'JOIN projectcollaborators c ON c.u_id = u.u_id AND c.project_id = $1',
		[projectId],
	);
	collaborators = collaborators.rows;
	for (var i = 0; i < collaborators.length; i++) {
		if (collaborators[i].u_id === userId) contributor = true;
	}
	res.json({ ...project, contributor, collaborators });
}, 'Failed to get project by id');

export const getProjectCollaborators = catchErrors(async (req, res) => {
	let projectId = req.query.projectId;

	let collaborators = await db.query(
		`SELECT u.username, u.profile_pic, u.u_id
	        FROM users u JOIN projectcollaborators c
	        ON c.u_id = u.u_id WHERE c.project_id = $1`,
		[projectId],
	);
	collaborators = collaborators.rows;
	res.json(collaborators);
}, 'Failed to get project collaborators');

export const updateProject = catchErrors(async (req, res) => {
	const { projectId, title, description, link, privateProject } = req.body;

	const client = await db.connect();

	try {
		await client.query('BEGIN');
		await client.query(
			`UPDATE projects SET title = $1, description = $2, link = $3, private = $4 WHERE project_id = $5`,
			[title, description, link, privateProject, projectId],
		);
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		throw new CustomError(`Failed to update project`, 500, e);
	} finally {
		client.release();
	}
	res.json({ title: title, description: description });
}, 'Failed to update project');

export const voteProject = catchErrors(async (req, res) => {
	let { vote, projectId } = req.body;
	const userId = req.decoded.u_id;
	let voteTarget = await db.query(
		`SELECT u_id, vote, project_id FROM projectvotes WHERE project_id = $1 AND u_id = $2`,
		[projectId, userId],
	);
	voteTarget = voteTarget.rows[0];

	const client = await db.connect();

	try {
		await client.query('BEGIN');
		if (!!voteTarget) {
			switch (vote) {
				case 0:
					vote = -voteTarget.vote;
					await client.query(
						`DELETE FROM projectvotes 
                            WHERE project_id = $1 AND u_id = $2`,
						[projectId, userId],
					);
					break;
				case 1:
					vote = 2;
					await client.query(
						`UPDATE projectvotes 
                            SET vote = 1 
                            WHERE project_id = $1 AND u_id = $2`,
						[projectId, userId],
					);
					break;
				case -1:
					vote = -2;
					await client.query(
						`UPDATE projectvotes 
                            SET vote = -1 
                            WHERE project_id = $1 AND u_id = $2`,
						[projectId, userId],
					);
					break;
				default:
					throw new Error('Failed to vote on project');
			}
		} else {
			await client.query(
				`INSERT INTO 
                    projectvotes (project_id, u_id, vote) 
                    VALUES ($1, $2, $3)`,
				[projectId, userId, vote],
			);
		}
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		throw new Error('Failed to vote on project');
	} finally {
		client.release();
	}
	res.json({ success: true });
}, 'Failed to vote on project');

export const updateColumn = catchErrors(async (req, res) => {
	const { title, columnId, wipLimit } = req.body;
	let newTitle = await db.query(
		`UPDATE boardcolumns SET title = $1, wip_limit = $2 
            WHERE column_id = $3
            RETURNING title`,
		[title, wipLimit, columnId],
	);
	newTitle = newTitle.rows[0];

	res.json({ title: newTitle.title });
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
	targetTask = targetTask.rows[0];

	const client = await db.connect();

	try {
		await client.query('BEGIN');
		await client.query(
			'DELETE FROM taskcollaborators ' + 'WHERE task_id = $1',
			[taskId],
		);
		await client.query(
			`
            DELETE FROM tasks WHERE task_id = $1
        `,
			[taskId],
		);
		if (targetTask.commentthread) {
			await client.query(
				`
                DELETE FROM commentthreads WHERE t_id = $1
            `,
				[targetTask.commentthread],
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
		'SELECT t.priority, t.description, t.commentthread, t.status, t.color_tag, t.task_id, t.title, t.column_id FROM tasks t ' +
			'WHERE t.task_id = $1',
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
		owner: !!collaborators.rows.find((col: any) => col.u_id === userId),
	};

	res.json(task);
}, 'Failed to get task');

export const addProjectCollaborator = catchErrors(async (req, res) => {
	const { userId, projectId } = req.body;
	const senderId = req.decoded.u_id;

	let senderCollaborator;
	let targetProject;
	let targetUser = await db.query(
		`SELECT username, u_id, profile_pic FROM users WHERE u_id = $1`,
		[userId],
	);
	targetUser = targetUser.rows[0];
	senderCollaborator = await db.query(
		`SELECT u_id, project_id FROM projectcollaborators WHERE u_id = $1 AND project_id = $2`,
		[senderId, projectId],
	);
	senderCollaborator = senderCollaborator.rows;
	console.log(senderCollaborator);
	if (!senderCollaborator.length) {
		throw new CustomError(
			'Failed to add user to project: unauthorized sender',
			403,
		);
	}
	targetProject = await db.query(
		`SELECT project_id, t_id FROM projects WHERE project_id = $1`,
		[projectId],
	);
	targetProject = targetProject.rows;
	if (!targetProject.length) {
		throw new CustomError(
			'Failed to add user to project: no project found matching given id',
			404,
		);
	} else {
		targetProject = targetProject[0];
	}

	const client = await db.connect();

	try {
		await client.query('BEGIN');
		await client.query(
			`INSERT INTO threadconnections (thread_id, user_id) VALUES ($1, $2)`,
			[targetProject.t_id, userId],
		);
		await client.query(
			`INSERT INTO projectcollaborators (project_id, u_id) VALUES ($1, $2)`,
			[projectId, userId],
		);
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		throw new Error('Failed to add user to project');
	} finally {
		client.release();
	}
	res.json(targetUser);
}, 'Failed to add user to project');

export const deleteProject = catchErrors(async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(422).json({
			status: 'error',
			message: 'Invalid input please try again.',
		});
	}
	const senderId = req.decoded.u_id;
	const { projectId } = req.body;
	let targetProject;
	try {
		targetProject = await db.query(
			`
        	SELECT from PROJECTS WHERE project_id = $1 AND creator = $2
        `,
			[projectId, senderId],
		);
		targetProject = targetProject.rows;
		if (!targetProject.length) {
			errorLogger.error(
				"Failed to delete project: Couldn't find project with the provided id.",
			);
			return res.status(404).json({
				status: 'error',
				message:
					"Failed to delete project: Couldn't find project with the provided id",
			});
		} else {
			targetProject = targetProject[0];
		}
	} catch (e) {
		errorLogger.error('Failed to delete project: ' + e);
		return res.status(500).json({
			status: 'error',
			message: 'Failed to delete project',
		});
	}
	const client = await db.connect();

	try {
		await client.query('BEGIN');
		if (targetProject.t_id) {
			await client.query(
				`
                DELETE FROM threads WHERE t_id = $1
            `,
				targetProject.t_id,
			);
		}
		await client.query(
			`
            DELETE FROM projects WHERE project_id = $1
        `,
			[projectId],
		);
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		throw new Error('Failed to delete project');
	} finally {
		client.release();
	}
	res.json({ success: true });
}, 'Failed to delete project');
