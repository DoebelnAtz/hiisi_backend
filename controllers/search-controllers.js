const { validationResult } = require('express-validator');
const { errorLogger, accessLogger } = require('../logger');
const db = require('../queries');

const searchAll = async (req, res) => {
    const q = req.query.q;

    let result;
    try {
        result = await db.query(
            `SELECT * FROM (
            SELECT u.username AS title, u.u_id AS id, 'user' AS type, '/user' AS link
            FROM users u
            UNION ALL 
            SELECT r.title, r.r_id AS id, 'resource' AS type, '/resources' AS link 
            FROM resources r 
            UNION ALL 
            SELECT b.title, b.b_id AS id, 'post' AS type, '/forum' AS link 
            FROM blogs b 
            UNION ALL 
            SELECT p.title, p.project_id AS id, 'project' AS type, '/projects' AS link 
            FROM projects p ORDER BY title ASC
            ) AS res WHERE LOWER(res.title) LIKE LOWER($1) LIMIT 10`, [q + '%']);
        result = result.rows;
    } catch(e) {
        errorLogger.error('Failed to search database: ' + e);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to search database'
        })
    }
    if (result.length < 10) {
        try {
            let matched = await db.query(
                `SELECT * FROM (
            SELECT u.username AS title, u.u_id AS id, 'user' AS type, '/user' AS link
            FROM users u
            UNION ALL 
            SELECT r.title, r.r_id AS id, 'resource' AS type, '/resources' AS link 
            FROM resources r 
            UNION ALL 
            SELECT b.title, b.b_id AS id, 'post' AS type, '/forum' AS link 
            FROM blogs b 
            UNION ALL 
            SELECT p.title, p.project_id AS id, 'project' AS type, '/projects' AS link 
            FROM projects p ORDER BY title ASC
            ) AS res WHERE LOWER(res.title) LIKE LOWER($1) LIMIT $2`, ['%' + q + '%', 10 - result.length]);
            result = [...result, ...matched.rows.filter(match => !result.find(res => res.title === match.title))];
        } catch(e) {
            errorLogger.error('Failed to search database: ' + e);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to search database'
            })
        }
    }

    res.json(result);
};


exports.searchAll = searchAll;