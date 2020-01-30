const { validationResult } = require('express-validator');
const { errorLogger, accessLogger} = require('../logger');
const db = require('../queries');

const addTaskToBoard = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid input please try again.'
        })
    }
    const userId = req.decoded.u_id;

    const { taskTitle, taskColumnId } = req.body;

    const client = await db.connect();
    let createdTask;
    try{
        await client.query('BEGIN');
        createdTask = await client.query('INSERT INTO tasks (title, column_id) VALUES ($1, $2)' +
            'RETURNING title, column_id, task_id, priority, description',
            [taskTitle, taskColumnId]);
        createdTask = createdTask.rows[0];
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        errorLogger.error('Failed to add task: ' + e);
        return res.status(500).json({
            success: false,
            status: 'error',
            message: 'Failed to add task.'
        })
    } finally {
        client.release();
    }
    res.status(201).json(createdTask);
};

const getBoardById = async (req, res) => {
    const boardId = req.params.bid;

    let board;
    try {
        board = await db.query('SELECT c.title AS column_title, b.board_id, c.column_id FROM boards b JOIN boardcolumns c ' +
            'ON b.board_id = c.board_id AND b.board_id = $1', [boardId]);
        board = board.rows;
    } catch (e) {
        errorLogger.error('Failed to get board by id: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get board by id'
        })
    }
    let resp;
    try {
        resp = {boardId: board[0].board_id, columns: []};
        for (var i = 0; i < board.length; i++) {
            let col = await db.query('SELECT t.priority, t.description, t.task_id, t.title, c.column_id FROM tasks t ' +
                'JOIN boardcolumns c ON t.column_id = c.column_id AND c.column_id = $1', [board[i].column_id]);
            resp.columns[i] = {column_id: board[i].column_id, column_number: i , title: board[i].column_title, tasks: col.rows};
        }
    } catch (e) {
        errorLogger.error('Failed to get board by id: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get board by Id'
        })
    }
    res.json(resp);
};

const getProjects = async (req, res) => {

    let projects;
    try {
        projects = await db.query(
            'SELECT p.title, p.created_date, p.votes, p.project_id FROM projects p'
        );
        projects = projects.rows;
    } catch (e) {
        errorLogger.error('Failed to get projects: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get projects'
        })
    }

    for (var i = 0; i < projects.length; i++) {
        try {
                let resp = await db.query(
                'SELECT u.profile_pic, u.u_id, u.username ' +
                'FROM projects p JOIN projectcollaborators c ON c.project_id = p.project_id ' +
                'JOIN users u ON c.u_id = u.u_id WHERE p.project_id = $1',
                [projects[i].project_id]);
            projects[i].collaborators = resp.rows;
        } catch (e) {
            errorLogger.error('Failed to get projects: ' + e);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to get projects.'
            })
        }
    }
    res.json(projects);
};

const getProjectById = async (req, res) => {
    const projectId = req.params.pid;
    const userId = req.decoded.u_id;

    let contributor = false;
    let project;
    try {
        project = await db.query(
            'SELECT p.title, p.commentthread, b.board_id, p.project_id, p.votes, p.t_id ' +
            'FROM projects p JOIN boards b ' +
            'ON b.project_id = p.project_id AND p.project_id = $1',
            [projectId]);
        project = project.rows[0];
    } catch (e) {
        errorLogger.error('Failed to get project by id: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get project by id'
        })
    }

    let collaborators;

    try {
        collaborators = await db.query(
            'SELECT u.username, u.u_id, u.profile_pic FROM users u ' +
            'JOIN projectcollaborators c ON c.u_id = u.u_id AND c.project_id = $1',
            [projectId]);
        collaborators = collaborators.rows;
        for (var i = 0; i < collaborators.length; i++) {
            if (collaborators[i].u_id === userId)
                contributor = true;
        }
    } catch (e) {
        errorLogger.error('Failed to get project by id: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get project by id'
        })
    }

    res.json({...project, contributor, collaborators})
};

const updateTask = async (req, res) => {
    const updatedTask = req.body;
    console.log( updatedTask );

    try {
        await db.query('UPDATE tasks ' +
            'SET title = $1, column_id = $2, ' +
            'description = $3, priority = $4' +
            'WHERE task_id = $5',
            [
                updatedTask.title, updatedTask.column_id,
                updatedTask.description, Number(updatedTask.priority),
                updatedTask.task_id
            ])
    } catch (e) {
        errorLogger.error('Failed to update task: ' + e);
        return res.status(500).json({
            success: false,
            status: 'error',
            message: 'Failed to update task'
        })
    }
    res.json({success: true});
};

const saveBoardState = async (req, res) => {
    const { boardState } = req.body;

    const client = await db.connect();

    try{
        await client.query('BEGIN');
        boardState.map(async (column) => {
            column.taskList.map(async (task) => {
                if (task > 0) {
                    await client.query(
                        'UPDATE tasks SET column_id = $1 WHERE task_id = $2',
                        [column.column_id, task])
                }
            }
        )
        });
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        errorLogger.error('Failed to add task: ' + e);
        return res.status(500).json({
            success: false,
            status: 'error',
            message: 'Failed to save board.'
        })
    } finally {
        client.release();
    }
    res.json({success: true})
};


exports.addTaskToBoard = addTaskToBoard;
exports.updateTask = updateTask;
exports.getBoardById = getBoardById;
exports.getProjects = getProjects;
exports.getProjectById = getProjectById;
exports.saveBoardState = saveBoardState;