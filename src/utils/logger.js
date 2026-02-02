/**
 * Winston logger module
 * Provides structured JSON logging with configurable log levels
 */
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.ATV_LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

export { logger };
