import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ValidationError } from '@utils/errors';

/**
 * Middleware to validate request data against Zod schema
 */
export const validate = (schema: AnyZodObject) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
        headers: req.headers,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Record<string, string[]> = {};
        error.errors.forEach((err) => {
          const path = err.path.slice(1).join('.'); // Remove 'body', 'query', or 'params' prefix
          if (!errors[path]) {
            errors[path] = [];
          }
          errors[path].push(err.message);
        });
        next(new ValidationError('Validation failed', errors));
      } else {
        next(error);
      }
    }
  };
};
