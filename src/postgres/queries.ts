import pg from 'pg';

const connectionName = process.env.DB_INST;

const dbConfig = {
	user: process.env.DB_USER,
	host: process.env.DB_ADDR,
	database: process.env.DB_NAME,
	password: process.env.DB_PASS,
};
console.log(dbConfig);

if (process.env.NODE_ENV === 'production') {
	dbConfig.host = `/cloudsql/${connectionName}`;
}

const pool = new pg.Pool(dbConfig);

const client = new pg.Client(dbConfig);

client.connect(function(err: Error) {
	console.log('CONNECTING....');
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
