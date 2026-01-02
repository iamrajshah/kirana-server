import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError, ValidationError } from '@utils/errors';
import { logger } from '@utils/logger';
import { config } from '@config/env';

/**
 * Global error handling middleware
 */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log error
  logger.error('Error:', {
    name: err.name,
    message: err.message,
    stack: config.env === 'development' ? err.stack : undefined,
  });

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    err.errors.forEach((error) => {
      const path = error.path.join('.');
      if (!errors[path]) {
        errors[path] = [];
      }
      errors[path].push(error.message);
    });

    const validationError = new ValidationError('Validation failed', errors);
    res.status(validationError.statusCode).json({
      success: false,
      message: validationError.message,
      errors: validationError.errors,
    });
    return;
  }

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    let message = 'Database error';
    let statusCode = 500;
    const prismaErr = err;

    switch (prismaErr.code) {
      case 'P2002':
        message = 'A record with this value already exists';
        statusCode = 409;
        break;
      case 'P2025':
        message = 'Record not found';
        statusCode = 404;
        break;
      case 'P2003':
        message = 'Foreign key constraint failed';
        statusCode = 400;
        break;
      default:
        message = config.env === 'development' ? prismaErr.message : 'Database operation failed';
    }

    res.status(statusCode).json({
      success: false,
      message,
      ...(config.env === 'development' && { code: prismaErr.code }),
    });
    return;
  }

  // Handle BigInt serialization errors
  if (err instanceof TypeError && err.message.includes('BigInt')) {
    logger.error('BigInt serialization error - check response formatters', {
      message: err.message,
      stack: err.stack,
    });

    res.status(500).json({
      success: false,
      message: 'Data serialization error. Please contact support.',
      ...(config.env === 'development' && {
        detail: 'BigInt fields must be converted to string/number before JSON serialization',
        stack: err.stack,
      }),
    });
    return;
  }

  // Handle application errors
  if (err instanceof AppError) {
    const response: {
      success: boolean;
      message: string;
      errors?: Record<string, string[]>;
    } = {
      success: false,
      message: err.message,
    };

    if (err instanceof ValidationError && err.errors) {
      response.errors = err.errors;
    }

    res.status(err.statusCode).json(response);
    return;
  }

  // Handle unknown errors
  res.status(500).json({
    success: false,
    message: config.env === 'development' ? err.message : 'Internal server error',
    ...(config.env === 'development' && { stack: err.stack }),
  });
};

/**
 * Middleware to handle 404 errors
 */
export const notFoundHandler = (_req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
};
