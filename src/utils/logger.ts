import winston from 'winston';
import { config } from '@config/env';

const REDACTED = '[REDACTED]';
const SENSITIVE_LOG_KEYS = new Set(['accesstoken', 'refreshtoken', 'authorization', 'authheader']);

const redactCredentialsInText = (value: string): string =>
  value
    .replace(/(\bBearer\s+)[^\s"',}]+/gi, `$1${REDACTED}`)
    .replace(
      /(\b(?:access[_-]?token|refresh[_-]?token)\b["']?\s*[:=]\s*["']?)([^\s"',}]+)/gi,
      `$1${REDACTED}`
    );

/**
 * Redact authentication credentials before Winston serializes log metadata.
 * The traversal mutates Winston's info object so its internal symbol fields are preserved.
 */
export const redactSensitiveLogData = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (typeof value === 'string') {
    return redactCredentialsInText(value);
  }

  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return value;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      value[index] = redactSensitiveLogData(item, seen);
    });
    return value;
  }

  const record = value as Record<string, unknown>;
  Object.keys(record).forEach((key) => {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    record[key] = SENSITIVE_LOG_KEYS.has(normalizedKey)
      ? REDACTED
      : redactSensitiveLogData(record[key], seen);
  });

  return value;
};

const redactAuthenticationData = winston.format((info) => {
  redactSensitiveLogData(info);
  return info;
});

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  redactAuthenticationData(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  redactAuthenticationData(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = `\n${JSON.stringify(meta, null, 2)}`;
    }
    return `${String(timestamp)} [${String(level)}]: ${String(message)}${metaStr}`;
  })
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: config.env === 'production' ? logFormat : consoleFormat,
  }),
];

// Add file transports in production
if (config.env === 'production') {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: logFormat,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: logFormat,
    })
  );
}

export const logger = winston.createLogger({
  level: config.log.level,
  format: logFormat,
  transports,
  exitOnError: false,
});

// Create a stream for Morgan
export const morganStream = {
  write: (message: string): void => {
    logger.info(message.trim());
  },
};
