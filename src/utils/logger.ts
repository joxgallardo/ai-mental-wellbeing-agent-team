import winston from 'winston';
import { loggingConfig } from '../config';
import { LogEntry } from '../types';

// Custom format for development
const developmentFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    return log;
  })
);

// JSON format for production
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

// Create logger instance
export const logger = winston.createLogger({
  level: loggingConfig.level,
  format: loggingConfig.format === 'json' ? productionFormat : developmentFormat,
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' }),
  ],
});

// Custom logger methods for structured logging
export const createLogger = (context: string) => ({
  info: (message: string, meta?: Record<string, any>) => {
    logger.info(message, { context, ...meta });
  },
  warn: (message: string, meta?: Record<string, any>) => {
    logger.warn(message, { context, ...meta });
  },
  error: (message: string, meta?: Record<string, any>) => {
    logger.error(message, { context, ...meta });
  },
  debug: (message: string, meta?: Record<string, any>) => {
    logger.debug(message, { context, ...meta });
  },
});

// Log entry helper
export const logEntry = (entry: LogEntry): void => {
  const { level, message, timestamp, agentName, sessionId, metadata } = entry;
  
  logger.log(level, message, {
    timestamp,
    agentName,
    sessionId,
    ...metadata,
  });
};

// Performance logging
export const logPerformance = (operation: string, duration: number, meta?: Record<string, any>): void => {
  logger.info(`Performance: ${operation}`, {
    operation,
    duration,
    unit: 'ms',
    ...meta,
  });
};

// Security logging
export const logSecurity = (event: string, details: Record<string, any>): void => {
  logger.warn(`Security event: ${event}`, {
    event,
    ...details,
    timestamp: new Date().toISOString(),
  });
};

export default logger; 