/**
 * Authentication Middleware
 * 
 * Simple API key authentication for development and production
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';

const logger = createLogger('AuthMiddleware');

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    type: 'api_key' | 'development';
  };
}

/**
 * Simple API key authentication middleware
 */
export const authenticateApiKey = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] as string;
  const expectedApiKey = process.env.API_KEY;

  // Development mode bypass
  if (process.env.NODE_ENV === 'development' && !expectedApiKey) {
    logger.debug('Development mode: bypassing authentication');
    req.user = {
      id: 'dev-user',
      type: 'development',
    };
    next();
    return;
  }

  if (!apiKey) {
    logger.warn('Authentication failed: missing API key', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    res.status(401).json({
      success: false,
      error: {
        message: 'Authentication required',
        code: 'MISSING_API_KEY',
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (!expectedApiKey) {
    logger.error('Authentication configuration error: API_KEY not set');
    res.status(500).json({
      success: false,
      error: {
        message: 'Authentication service unavailable',
        code: 'AUTH_CONFIG_ERROR',
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (apiKey !== expectedApiKey) {
    logger.warn('Authentication failed: invalid API key', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      providedKey: apiKey.substring(0, 8) + '***',
    });

    res.status(401).json({
      success: false,
      error: {
        message: 'Invalid API key',
        code: 'INVALID_API_KEY',
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  logger.debug('Authentication successful', {
    path: req.path,
    method: req.method,
  });

  req.user = {
    id: 'api-user',
    type: 'api_key',
  };

  next();
};

/**
 * Optional authentication middleware (doesn't fail if no auth provided)
 */
export const optionalAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] as string;
  const expectedApiKey = process.env.API_KEY;

  if (!apiKey || !expectedApiKey || apiKey !== expectedApiKey) {
    // No authentication provided or invalid - continue without user context
    next();
    return;
  }

  req.user = {
    id: 'api-user',
    type: 'api_key',
  };

  next();
};

/**
 * Development-only middleware (blocks in production)
 */
export const developmentOnly = (req: Request, res: Response, next: NextFunction): void => {
  if (process.env.NODE_ENV === 'production') {
    logger.warn('Development endpoint accessed in production', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    res.status(404).json({
      success: false,
      error: {
        message: 'Not found',
        code: 'NOT_FOUND',
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  next();
};