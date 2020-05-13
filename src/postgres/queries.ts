const pg = require('pg');

const pool = new pg.Pool({
	user: 'root',
	host: '127.0.0.1',
	database: 'hivemind',
	password: process.env.db,
});

const client = new pg.Client({
	user: 'root',
	host: '127.0.0.1',
	database: 'hivemind',
	password: process.env.db,
});

client.connect(function(err: Error) {
	if (err) {
		return console.error('could not connect to postgres', err);
	}
	client.query('SELECT NOW() AS "theTime"', function(
		err: Error,
		result: any,
	) {
		if (err) {
			return console.error('error running query', err);
		}
		console.log(result.rows[0].theTime);
		client.end();
	});
});

export default {
	query: (text: string, params?: any[]) => {
		return pool.query(text, params);
	},
	connect: () => pool.connect(),
};
