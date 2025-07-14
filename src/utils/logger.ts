import winston from 'winston';
import { loggingConfig } from '../config/index';

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
      maxFiles: 3,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 3,
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' }),
  ],
});

// Helper function to create logger for specific modules
export const createLogger = (moduleName: string) => {
  return winston.createLogger({
    level: loggingConfig.level,
    format: loggingConfig.format === 'json' ? productionFormat : developmentFormat,
    defaultMeta: { module: moduleName },
    transports: [
      new winston.transports.Console(),
    ],
  });
}; 