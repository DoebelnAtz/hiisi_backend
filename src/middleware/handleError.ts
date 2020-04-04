import { ErrorRequestHandler } from 'express';
import { errorLogger } from '../logger';

export const handleError: ErrorRequestHandler = (error, req, res, next) => {
	errorLogger.error(
		`${error.status}: ${error.description} | code: ${error.code}`,
	);
	return res.status(error.status).json({ error: error.response });
};
