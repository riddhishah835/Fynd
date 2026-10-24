import mongoose from 'mongoose';
import { ZodError } from 'zod';
import AppError from '../utils/AppError.js';

export function notFoundHandler(req, res, next) {
  next(new AppError('NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(error, req, res, next) {
  let code = 'SERVER_ERROR';
  let message = 'Internal server error';
  let statusCode = 500;
  let details = [];

  if (error instanceof AppError) {
    ({ code, message, statusCode, details } = error);
  } else if (error instanceof ZodError) {
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    statusCode = 400;
    details = error.issues;
  } else if (error instanceof mongoose.Error.ValidationError) {
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    statusCode = 400;
    details = Object.values(error.errors).map(({ path, message: issueMessage }) => ({
      path,
      message: issueMessage,
    }));
  } else if (error instanceof mongoose.Error.CastError) {
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    statusCode = 400;
    details = [{ path: error.path, message: error.message }];
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
      details,
    },
  });
}
