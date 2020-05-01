"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg = require('pg');
const pool = new pg.Pool({
    user: 'root',
    host: '161.35.20.240',
    database: 'hivemind',
    password: process.env.db,
});
const client = new pg.Client({
    user: 'root',
    host: '161.35.20.240',
    database: 'hivemind',
    password: process.env.db,
});
client.connect(function (err) {
    if (err) {
        return console.error('could not connect to postgres', err);
    }
    client.query('SELECT NOW() AS "theTime"', function (err, result) {
        if (err) {
            return console.error('error running query', err);
        }
        console.log(result.rows[0].theTime);
        client.end();
    });
});
exports.default = {
    query: (text, params) => {
        return pool.query(text, params);
    },
    connect: () => pool.connect(),
};
//# sourceMappingURL=queries.js.map