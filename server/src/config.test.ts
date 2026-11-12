import { describe, it, expect } from 'vitest';
import { ConfigError, loadConfig } from './config.js';

const real = {
  DATABASE_URL: 'postgres://user:pa55word@db.example.com:5432/postgres',
  CLIENT_ORIGIN: 'https://app.example.com',
  ANTHROPIC_API_KEY: 'sk-ant-test-key-123',
};

const problemsOf = (env: Record<string, string | undefined>) => {
  try {
    loadConfig(env);
  } catch (err) {
    expect(err).toBeInstanceOf(ConfigError);
    return (err as ConfigError).problems;
  }
  throw new Error('expected loadConfig to throw');
};

describe('loadConfig', () => {
  it('reads a valid real-mode environment and fills the defaults', () => {
    expect(loadConfig(real)).toEqual({
      port: 3000,
      databaseUrl: real.DATABASE_URL,
      callLimit: 20,
      clientOrigin: 'https://app.example.com',
      coachModel: 'claude-sonnet-5-5',
      coachMode: 'real',
      anthropicApiKey: 'sk-ant-test-key-123',
      production: false,
    });
  });

  it('honors every setting', () => {
    const config = loadConfig({
      ...real, PORT: '8080', MAX_COACH_CALLS_PER_DAY: '7', COACH_MODEL: 'some-model', NODE_ENV: 'production',
    });
    expect(config).toMatchObject({ port: 8080, callLimit: 7, coachModel: 'some-model', production: true });
  });

  it('needs no API key in fake mode', () => {
    const config = loadConfig({ DATABASE_URL: real.DATABASE_URL, CLIENT_ORIGIN: real.CLIENT_ORIGIN, COACH_MODE: 'fake' });
    expect(config.coachMode).toBe('fake');
    expect(config.anthropicApiKey).toBeUndefined();
  });

  it('refuses to start without an API key in real mode', () => {
    for (const key of [undefined, '', '   ']) {
      expect(problemsOf({ ...real, ANTHROPIC_API_KEY: key }).join(' ')).toMatch(/ANTHROPIC_API_KEY/);
    }
  });

  it('refuses the fake coach when NODE_ENV is production', () => {
    const env = { DATABASE_URL: real.DATABASE_URL, CLIENT_ORIGIN: real.CLIENT_ORIGIN, COACH_MODE: 'fake' };
    expect(problemsOf({ ...env, NODE_ENV: 'production' }).join(' ')).toMatch(/COACH_MODE/);
    expect(loadConfig({ ...env, NODE_ENV: 'development' }).coachMode).toBe('fake');
    expect(loadConfig({ ...real, NODE_ENV: 'production' }).coachMode).toBe('real');
  });

  it('refuses an unknown COACH_MODE', () => {
    expect(problemsOf({ ...real, COACH_MODE: 'maybe' }).join(' ')).toMatch(/COACH_MODE/);
  });

  it('requires DATABASE_URL and CLIENT_ORIGIN', () => {
    expect(problemsOf({ ...real, DATABASE_URL: undefined }).join(' ')).toMatch(/DATABASE_URL/);
    expect(problemsOf({ ...real, CLIENT_ORIGIN: '' }).join(' ')).toMatch(/CLIENT_ORIGIN/);
  });

  it.each(['app.example.com', 'https://app.example.com/', 'https://app.example.com/path', 'ftp://app.example.com', 'https://', '*'])(
    'refuses CLIENT_ORIGIN "%s" (it must be a bare http(s) origin)',
    (origin) => {
      expect(problemsOf({ ...real, CLIENT_ORIGIN: origin }).join(' ')).toMatch(/CLIENT_ORIGIN/);
    },
  );

  it.each(['https://app.example.com', 'http://localhost:5173', 'https://coach-app.vercel.app'])('accepts CLIENT_ORIGIN %s', (origin) => {
    expect(loadConfig({ ...real, CLIENT_ORIGIN: origin }).clientOrigin).toBe(origin);
  });

  it.each(['0', '-1', 'abc', '99999999999'])('refuses MAX_COACH_CALLS_PER_DAY "%s" (same rule as the cap)', (value) => {
    expect(problemsOf({ ...real, MAX_COACH_CALLS_PER_DAY: value }).join(' ')).toMatch(/MAX_COACH_CALLS_PER_DAY/);
  });

  it.each(['0', '70000', 'abc', '80.5', ''])('refuses PORT "%s"', (port) => {
    expect(problemsOf({ ...real, PORT: port }).join(' ')).toMatch(/PORT/);
  });

  it('reports every problem at once', () => {
    const problems = problemsOf({ MAX_COACH_CALLS_PER_DAY: 'abc', COACH_MODE: 'maybe' });
    const text = problems.join(' ');
    for (const name of ['DATABASE_URL', 'CLIENT_ORIGIN', 'MAX_COACH_CALLS_PER_DAY', 'COACH_MODE']) expect(text).toContain(name);
  });

  it('never puts a secret value in an error message', () => {
    const problems = problemsOf({ DATABASE_URL: 'postgres://user:pa55word@host/db?bad', CLIENT_ORIGIN: '*', ANTHROPIC_API_KEY: 'sk-ant-secret-value', COACH_MODE: 'maybe' });
    const text = problems.join(' ');
    expect(text).not.toContain('pa55word');
    expect(text).not.toContain('sk-ant-secret-value');
  });

  it('refuses a DATABASE_URL that is not a postgres URL, without echoing it', () => {
    const problems = problemsOf({ ...real, DATABASE_URL: 'mysql://user:pa55word@host/db' });
    expect(problems.join(' ')).toMatch(/DATABASE_URL/);
    expect(problems.join(' ')).not.toContain('pa55word');
  });
});
