import pg from 'pg';
import { createApp } from './app.js';
import { ConfigError, loadConfig } from './config.js';
import { logError } from './log.js';
import { buildDeps } from './wire.js';

// Any configuration problem stops the server before it listens (a missing key in real mode, a bad cap setting ...).
let config;
try {
  config = loadConfig();
} catch (err) {
  if (!(err instanceof ConfigError)) throw err;
  console.error('Invalid configuration:');
  for (const problem of err.problems) console.error(` - ${problem}`);
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: config.databaseUrl });
pool.on('error', (err) => logError('database pool error', err)); // an idle connection dropping must not crash the server

const server = createApp(buildDeps(config, pool)).listen(config.port, () => {
  console.log(`server listening on ${config.port} (coach: ${config.coachMode}, daily limit: ${config.callLimit})`);
});

// Render stops the service with SIGTERM: finish open requests, then close the database connections.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
  });
}
