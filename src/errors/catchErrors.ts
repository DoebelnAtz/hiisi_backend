import { RequestHandler } from 'express';
import { validationResult } from 'express-validator';
import CustomError from './customError';

export const catchErrors = (requestHandler: RequestHandler, errorMessage: string = 'Error'): RequestHandler => {
  return async (req, res, next): Promise<any> => {
    const errors = validationResult(req);
	if (!errors.isEmpty()) {
	    return next(new CustomError(
          errorMessage,
          401,
          'Invalid input',
        ))
	}
    try {
      return await requestHandler(req, res, next);
    } catch (error) {
      next(new CustomError(
          error.message || errorMessage,
		  error.status || 500,
		  error.description || error,
		  error.code
      ));
    }
  };
};