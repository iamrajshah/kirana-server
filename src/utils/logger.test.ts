import { Writable } from 'stream';
import winston from 'winston';
import { redactSensitiveLogData } from './logger';
import { logger } from './logger';

describe('redactSensitiveLogData', () => {
  it('redacts authentication secrets recursively without changing safe metadata', () => {
    const metadata = {
      accessToken: 'access-secret',
      refresh_token: 'refresh-secret',
      headers: {
        Authorization: 'Bearer header-secret',
        'content-type': 'application/json',
      },
      context: [{ authHeader: 'Bearer nested-secret' }, { requestId: 'request-123' }],
    };

    expect(redactSensitiveLogData(metadata)).toEqual({
      accessToken: '[REDACTED]',
      refresh_token: '[REDACTED]',
      headers: {
        Authorization: '[REDACTED]',
        'content-type': 'application/json',
      },
      context: [{ authHeader: '[REDACTED]' }, { requestId: 'request-123' }],
    });
    expect(metadata.accessToken).toBe('access-secret');
    expect(metadata.headers.Authorization).toBe('Bearer header-secret');
  });

  it('redacts bearer credentials embedded in log messages', () => {
    expect(redactSensitiveLogData('Request failed with Authorization: Bearer header-secret')).toBe(
      'Request failed with Authorization: [REDACTED]'
    );
  });

  it('redacts named tokens after logger interpolation', () => {
    expect(redactSensitiveLogData('Auth result {"accessToken":"access-secret"}')).toBe(
      'Auth result {"accessToken":"[REDACTED]"}'
    );
  });

  it('redacts credentials through the configured Winston logger without mutating input', async () => {
    let output = '';
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        output += String(chunk);
        callback();
      },
    });
    const testTransport = new winston.transports.Stream({
      stream,
      format: winston.format.json(),
    });
    const originalTransports = [...logger.transports];
    const metadata = {
      accessToken: 'access-secret',
      refresh_token: 'refresh-secret',
      headers: {
        authorizationHeader: 'Basic header-secret',
      },
    };

    logger.clear();
    logger.add(testTransport);

    try {
      logger.info('Auth result', metadata);
      logger.warn('Request failed with Authorization: Basic text-secret');
      logger.error('Interpolated auth result %j', metadata);
      await new Promise<void>((resolve) => setImmediate(resolve));
    } finally {
      logger.clear();
      originalTransports.forEach((transport) => logger.add(transport));
    }

    expect(output).toContain('[REDACTED]');
    expect(output).not.toContain('access-secret');
    expect(output).not.toContain('refresh-secret');
    expect(output).not.toContain('header-secret');
    expect(output).not.toContain('text-secret');
    expect(metadata.accessToken).toBe('access-secret');
    expect(metadata.refresh_token).toBe('refresh-secret');
    expect(metadata.headers.authorizationHeader).toBe('Basic header-secret');
  });
});
