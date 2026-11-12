import { DEFAULT_CALL_LIMIT, parseCallLimit } from './db/cap.js';

export interface Config {
  port: number;
  databaseUrl: string;
  callLimit: number;
  clientOrigin: string;
  coachModel: string;
  coachMode: 'real' | 'fake';
  anthropicApiKey: string | undefined;
  production: boolean;
}

// Every problem with the environment at once. Messages name variables, never secret values.
export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid configuration: ${problems.join('; ')}`);
    this.name = 'ConfigError';
  }
}

const blank = (v: string | undefined) => v === undefined || v.trim() === '';

function isBareHttpOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value;
  } catch {
    return false;
  }
}

// Reads and checks the environment once, at startup (design.md section 9). The server refuses to run on any problem:
// a missing API key in real mode, a bad cap setting, a missing database or client origin, or the fake coach in production.
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const problems: string[] = [];

  let port = 3000;
  if (env.PORT !== undefined) {
    if (/^\d+$/.test(env.PORT) && Number(env.PORT) >= 1 && Number(env.PORT) <= 65535) port = Number(env.PORT);
    else problems.push('PORT must be a whole number from 1 to 65535.');
  }

  const databaseUrl = env.DATABASE_URL ?? '';
  if (blank(databaseUrl)) problems.push('DATABASE_URL is required.');
  else if (!/^postgres(ql)?:\/\//.test(databaseUrl)) problems.push('DATABASE_URL must be a postgres:// connection string.');

  let callLimit = DEFAULT_CALL_LIMIT;
  try {
    callLimit = parseCallLimit(env.MAX_COACH_CALLS_PER_DAY);
  } catch (err) {
    problems.push((err as Error).message);
  }

  // The one origin allowed by CORS: a bare http(s) origin, no path, no trailing slash, no wildcard.
  const clientOrigin = env.CLIENT_ORIGIN ?? '';
  if (blank(clientOrigin)) problems.push('CLIENT_ORIGIN is required.');
  else {
    const isOrigin = isBareHttpOrigin(clientOrigin);
    if (!isOrigin) problems.push('CLIENT_ORIGIN must be a bare http(s) origin such as https://app.example.com (no path, no trailing slash).');
  }

  const production = env.NODE_ENV === 'production';
  const mode = env.COACH_MODE ?? 'real';
  if (mode !== 'real' && mode !== 'fake') problems.push('COACH_MODE must be "real" or "fake".');
  else if (mode === 'fake' && production) problems.push('COACH_MODE=fake is not allowed when NODE_ENV is production.');
  if (mode === 'real' && blank(env.ANTHROPIC_API_KEY)) problems.push('ANTHROPIC_API_KEY is required when COACH_MODE is real.');

  if (problems.length > 0) throw new ConfigError(problems);
  return {
    port,
    databaseUrl,
    callLimit,
    clientOrigin,
    coachModel: blank(env.COACH_MODEL) ? 'claude-sonnet-5-5' : (env.COACH_MODEL as string),
    coachMode: mode as 'real' | 'fake',
    anthropicApiKey: blank(env.ANTHROPIC_API_KEY) ? undefined : env.ANTHROPIC_API_KEY,
    production,
  };
}
