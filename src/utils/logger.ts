import winston from 'winston';
import { config } from '@config/env';

const REDACTED = '[REDACTED]';
const SENSITIVE_LOG_KEYS = new Set([
  'accesstoken',
  'refreshtoken',
  'authorization',
  'authorizationheader',
  'authheader',
]);

const normalizeLogKey = (key: string): string => key.toLowerCase().replace(/[^a-z0-9]/g, '');

const isSensitiveLogKey = (key: string): boolean => SENSITIVE_LOG_KEYS.has(normalizeLogKey(key));

const redactCredentialsInText = (value: string): string =>
  value
    .replace(
      /(\bauthorization(?:[_-]?header)?\b["']?\s*[:=]\s*["']?)([^"',}\n]+)/gi,
      `$1${REDACTED}`
    )
    .replace(/(\bBearer\s+)[^\s"',}]+/gi, `$1${REDACTED}`)
    .replace(
      /(\b(?:access[_-]?token|refresh[_-]?token)\b["']?\s*[:=]\s*["']?)([^\s"',}]+)/gi,
      `$1${REDACTED}`
    );

/**
 * Redact authentication credentials before Winston serializes log metadata.
 * The traversal mutates Winston's info object so its internal symbol fields are preserved.
 */
export const redactSensitiveLogData = (
  value: unknown,
  seen = new WeakMap<object, unknown>()
): unknown => {
  if (typeof value === 'string') {
    return redactCredentialsInText(value);
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  const existingCopy = seen.get(value);
  if (existingCopy) {
    return existingCopy;
  }

  if (value instanceof Date || Buffer.isBuffer(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    seen.set(value, copy);
    value.forEach((item) => copy.push(redactSensitiveLogData(item, seen)));
    return copy;
  }

  const record = value as Record<string, unknown>;
  const copy: Record<string, unknown> = {};
  seen.set(value, copy);
  Object.keys(record).forEach((key) => {
    copy[key] = isSensitiveLogKey(key) ? REDACTED : redactSensitiveLogData(record[key], seen);
  });

  return copy;
};

const redactAuthenticationData = winston.format((info) => {
  Reflect.ownKeys(info).forEach((key) => {
    info[key] =
      typeof key === 'string' && isSensitiveLogKey(key)
        ? REDACTED
        : redactSensitiveLogData(info[key]);
  });
  return info;
});

const redactFormattedMessage = winston.format((info) => {
  if (typeof info.message === 'string') {
    info.message = redactCredentialsInText(info.message);
  }
  return info;
});

const loggerFormat = winston.format.combine(
  winston.format.errors({ stack: true }),
  redactAuthenticationData(),
  winston.format.splat(),
  redactFormattedMessage()
);

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
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
  format: loggerFormat,
  transports,
  exitOnError: false,
});

// Create a stream for Morgan
export const morganStream = {
  write: (message: string): void => {
    logger.info(message.trim());
  },
};
