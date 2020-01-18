const { validationResult } = require('express-validator');
const { errorLogger, accessLogger} = require('../logger');
const db = require('../queries');

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
            message: 'Failed to get board by id'
        })
    }
    console.log(resp);
    res.json(resp);
};

exports.getBoardById = getBoardById;