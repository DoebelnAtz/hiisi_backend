const { validationResult } = require('express-validator');
const { errorLogger, accessLogger} = require('../logger');
const db = require('../queries');

const addTaskToBoard = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(401).json({
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
            'RETURNING title as task_title, column_id, task_id',
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
            let col = await db.query('SELECT t.task_id, t.title AS task_title, c.column_id FROM tasks t ' +
                'JOIN boardcolumns c ON t.column_id = c.column_id AND c.column_id = $1', [board[i].column_id]);
            resp.columns[i] = {column_id: board[i].column_id, title: board[i].column_title, taskList: [...col.rows,  {task_id: -i, task_title: '', spacer: true}]};
        }
    } catch (e) {
        errorLogger.error('Failed to get board by id: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get board by Id'
        })
    }
    console.log(resp);
    res.json(resp);
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
exports.getBoardById = getBoardById;
exports.saveBoardState = saveBoardState;