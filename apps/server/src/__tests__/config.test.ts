import { describe, it, expect } from 'vitest';
import { config } from '../lib/config';

describe('config', () => {
  it('should load default values', () => {
    expect(config.port).toBe(3001);
    expect(config.nodeEnv).toBe('test');
    expect(config.databaseUrl).toContain('aibuyworld');
    expect(config.redisUrl).toContain('redis://');
  });

  it('should have JWT config', () => {
    expect(config.jwt.secret).toBeTruthy();
    expect(config.jwt.accessExpiry).toBe('15m');
    expect(config.jwt.refreshExpiry).toBe('7d');
  });
});
