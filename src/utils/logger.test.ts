import { redactSensitiveLogData } from './logger';

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
  });

  it('redacts bearer credentials embedded in log messages', () => {
    expect(redactSensitiveLogData('Request failed with Authorization: Bearer header-secret')).toBe(
      'Request failed with Authorization: Bearer [REDACTED]'
    );
  });

  it('redacts named tokens after logger interpolation', () => {
    expect(redactSensitiveLogData('Auth result {"accessToken":"access-secret"}')).toBe(
      'Auth result {"accessToken":"[REDACTED]"}'
    );
  });
});
