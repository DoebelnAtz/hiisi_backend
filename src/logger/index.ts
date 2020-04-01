const { createLogger, transports, format } = require('winston');

export const accessLogger = createLogger({
	format: format.combine(
		format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
		format.printf(
			(info: any) => `${info.timestamp} ${info.level}: ${info.message}`,
		),
	),
	transports: [
		new transports.File({
			filename: './logs/access.log',
			json: false,
			maxsize: 2000000, // 2 MB
			maxFiles: 5,
		}),
		new transports.Console(),
	],
});

export const errorLogger = createLogger({
	format: format.combine(
		format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
		format.printf(
			(info: any) => `${info.timestamp} ${info.level}: ${info.message}`,
		),
	),
	transports: [
		new transports.File({
			filename: './logs/error.log',
			json: false,
			maxsize: 20000000, // 2 MB
			maxFiles: 5,
		}),
		new transports.Console(),
	],
});

