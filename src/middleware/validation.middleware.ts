/**
 * Validation Middleware
 * 
 * Request validation middleware using Zod schemas
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { createLogger } from '../utils/logger';

const logger = createLogger('ValidationMiddleware');

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Middleware to validate request body against Zod schema
 */
export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors: ValidationError[] = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          value: err.path.length > 0 ? req.body[err.path[0]] : req.body,
        }));

        logger.warn('Request validation failed', {
          path: req.path,
          method: req.method,
          errors: validationErrors,
        });

        res.status(400).json({
          success: false,
          error: {
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: validationErrors,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger.error('Unexpected validation error', {
        path: req.path,
        method: req.method,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR',
        },
        timestamp: new Date().toISOString(),
      });
    }
  };
};

/**
 * Middleware to validate query parameters against Zod schema
 */
export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors: ValidationError[] = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          value: err.path.length > 0 ? req.query[err.path[0]] : req.query,
        }));

        logger.warn('Query validation failed', {
          path: req.path,
          method: req.method,
          errors: validationErrors,
        });

        res.status(400).json({
          success: false,
          error: {
            message: 'Query validation failed',
            code: 'QUERY_VALIDATION_ERROR',
            details: validationErrors,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR',
        },
        timestamp: new Date().toISOString(),
      });
    }
  };
};

/**
 * Middleware to validate route parameters against Zod schema
 */
export const validateParams = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.params);
      req.params = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors: ValidationError[] = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          value: err.path.length > 0 ? req.params[err.path[0]] : req.params,
        }));

        logger.warn('Params validation failed', {
          path: req.path,
          method: req.method,
          errors: validationErrors,
        });

        res.status(400).json({
          success: false,
          error: {
            message: 'Parameter validation failed',
            code: 'PARAMS_VALIDATION_ERROR',
            details: validationErrors,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR',
        },
        timestamp: new Date().toISOString(),
      });
    }
  };
};