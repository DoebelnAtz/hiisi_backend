const { validationResult } = require('express-validator');
const { errorLogger, accessLogger} = require('../logger');
const db = require('../queries');
const removeDup = require('../utils/utils').removeDup;

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
            'RETURNING task_id, title, priority, description',
            [taskTitle, taskColumnId]);
        createdTask = createdTask.rows[0];
        await client.query(
            'INSERT INTO taskcollaborators (task_id, u_id) VALUES ($1, $2)',
            [createdTask.task_id, userId]);
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

    let collaborators;
    try {
        collaborators = await db.query('' +
            'SELECT t.task_id, u.username, u.profile_pic, u.u_id FROM tasks t ' +
            'JOIN taskcollaborators c ON c.task_id = t.task_id ' +
            'JOIN users u ON c.u_id = u.u_id ' +
            'WHERE t.task_id = $1', [createdTask.task_id]);
        collaborators = collaborators.rows;
    } catch (e) {
        errorLogger.error('Failed to get collaborators to task: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get collaborators to task'
        })
    }
    res.status(201).json({...createdTask, collaborators: collaborators});
};

const addCollaboratorToTask = async (req, res) => {
    const { userId, taskId } = req.body;

    try {
        await db.query(
            'INSERT INTO taskcollaborators (u_id, task_id) VALUES ($1, $2)',
            [userId, taskId]
        )
    } catch (e) {
        errorLogger.error('Failed to add collaborator to task: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to add collaborator to task'
        })
    }
    let collaborators;
    try {
        collaborators = await db.query('' +
            'SELECT t.task_id, u.username, u.profile_pic, u.u_id FROM tasks t ' +
            'JOIN taskcollaborators c ON c.task_id = t.task_id ' +
            'JOIN users u ON c.u_id = u.u_id ' +
            'WHERE t.task_id = $1', [taskId]);
        collaborators = collaborators.rows;
    } catch (e) {
        errorLogger.error('Failed to get collaborators to task: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get collaborators to task'
        })
    }
    res.status(201).json({collaborators});
};

const getBoardById = async (req, res) => {

    const boardId = req.params.bid;
    // lol, this will be fun to optimize..
    let board;

    try {
        board = await db.query(
            `SELECT 
            u.username, u.profile_pic, u.u_id, 
            c.title AS column_title, c.column_id, 
            b.board_id, 
            t.priority, t.title AS task_title, t.task_id, t.description 
            FROM boards b 
            JOIN boardcolumns c 
            ON b.board_id = c.board_id 
            LEFT JOIN tasks t ON t.column_id = c.column_id 
            LEFT JOIN taskcollaborators tc ON tc.task_id = t.task_id 
            LEFT JOIN users u ON u.u_id = tc.u_id WHERE b.board_id = $1 ORDER BY c.column_id ASC, task_title ASC`
            , [boardId]);
        board = board.rows;
        let taskId = removeDup(board.map(t => t.task_id));
        let colId = removeDup(board.map(t => t.column_id));
        let colTitles = removeDup(board.map(t => t.column_title));
        let taskTitles = removeDup(board.map(t => t.task_title));
        console.log(colTitles);
        let columns = [];
        let prevCol = 0;
        let prevCollab = 0;
        let taskIndex = -1;
        let colIndex = -1;
        let prevTask = 0;

        for (let i = 0; i < board.length; i++) {

            if (board[i].column_id !== prevCol) {
                colIndex++;
                columns.push({
                    column_title: board[i].column_title,
                    column_id: board[i].column_id,
                    column_number: colIndex,
                    tasks: []
                });
                taskIndex = -1;

            }
            if(board[i].task_id !== prevTask && !!board[i].task_id) {
                taskIndex++;
                columns[colIndex].tasks.push({
                    title: board[i].task_title,
                    task_id: board[i].task_id,
                    priority: board[i].priority,
                    collaborators: []
                });
            }
            if (!!board[i].u_id) {
                columns[colIndex].tasks[taskIndex].collaborators.push({
                    u_id: board[i].u_id,
                    username: board[i].username,
                    profile_pic: board[i].profile_pic
                });
            }

            prevTask  = board[i].task_id;
            prevCol = board[i].column_id;
        }
        board = {columns};
    } catch(e) {
        errorLogger.error('Failed to get board by Id: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get board by Id'
        })
    }
    // try {
    //     board = await db.query(
    //         'SELECT c.title AS column_title, b.board_id, c.column_id FROM boards b ' +
    //         'JOIN boardcolumns c ' +
    //         'ON b.board_id = c.board_id WHERE b.board_id = $1', [boardId]);
    //     board = board.rows;
    // } catch (e) {
    //     errorLogger.error('Failed to get board by id: ' + e);
    //     return res.status(500).json({
    //         status: 'error',
    //         message: 'Failed to get board by id'
    //     })
    // }
    // let resp;
    // try {
    //     resp = {boardId: board[0].board_id, columns: []};
    //     for (var i = 0; i < board.length; i++) {
    //         let col = await db.query(
    //             'SELECT t.priority, t.description, t.task_id, t.title, c.column_id ' +
    //             'FROM tasks t ' +
    //             'JOIN boardcolumns c ON t.column_id = c.column_id ' +
    //             'WHERE c.column_id = $1',
    //             [board[i].column_id]);
    //         try {
    //             let collaborators = await db.query('SELECT u.profile_pic, u.u_id, t.task_id FROM users u ' +
    //                 'JOIN taskcollaborators p ON p.u_id = u.u_id ' +
    //                 'JOIN tasks t ON t.task_id = p.task_id ' +
    //                 'WHERE t.column_id = $1', [board[i].column_id]);
    //
    //             // Getting all collaborators for each
    //             // column and formatting JSON to save 300ms on query time
    //             // could still be improved
    //
    //             for (var j = 0; j < col.rows.length; j++) {
    //                 col.rows[j] = {
    //                     ...col.rows[j],
    //                     collaborators: collaborators.rows.filter(
    //                         c => c.task_id === col.rows[j].task_id)
    //                 }
    //             }
    //         } catch (e) {
    //             errorLogger.error('Failed to get task collaborators: ' + e);
    //             return res.status(500).json({
    //                 status: 'error',
    //                 message: 'Failed to get task collaborators'
    //             })
    //         }
    //         resp.columns[i] = {
    //             column_id: board[i].column_id,
    //             column_number: i ,
    //             title: board[i].column_title,
    //             tasks: col.rows};
    //     }
    // } catch (e) {
    //     errorLogger.error('Failed to get board by id: ' + e);
    //     return res.status(500).json({
    //         status: 'error',
    //         message: 'Failed to get board by Id'
    //     })
    // }
    res.json(board);
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


const getTaskById = async (req, res) => {
    const userId = req.decoded.u_id;
    const taskId = req.params.tid;
    let task;
    try {
        task = await db.query(
            'SELECT t.priority, t.description, t.task_id, t.title, t.column_id FROM tasks t ' +
            'WHERE t.task_id = $1'
            ,[taskId]
        );

        let collaborators = await db.query(
            'SELECT u.username, u.profile_pic, u.u_id ' +
            'FROM users u JOIN taskcollaborators c ON c.u_id = u.u_id ' +
            'WHERE c.task_id = $1'
            ,[taskId]
        );
        task = {...task.rows[0], collaborators: collaborators.rows, owner: !!collaborators.rows.find(col => col.u_id === userId)}
    } catch (e) {
        errorLogger.error('Failed to get task: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get task'
        })
    }
    res.json(task);
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
exports.getTaskById = getTaskById;
exports.addCollaboratorToTask = addCollaboratorToTask;