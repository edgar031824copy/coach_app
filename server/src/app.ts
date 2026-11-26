import express, { type ErrorRequestHandler } from 'express';
import type { ApiError } from 'shared';
import { generatePlan, type GenerateDeps } from './generate-plan.js';
import { logError } from './log.js';
import { todayUtc, validateOnboarding, validateWeekStart } from 'shared';

export type AppDeps = GenerateDeps & { clientOrigin: string };

const BODY_LIMIT = '16kb'; // 🔶 specs/onboarding, free-text length limits

// CORS allows exactly one origin, the client's (specs/deploy: restricted origin). A browser request from any other
// origin gets no permission header, and its preflight is refused. Requests without an Origin header (curl, the smoke
// test) are served as usual: CORS is a browser rule, not access control. Never a wildcard.
function cors(clientOrigin: string): express.RequestHandler {
  return (req, res, next) => {
    res.vary('Origin');
    const origin = req.headers.origin;
    if (origin === undefined) return next();
    if (origin !== clientOrigin) return req.method === 'OPTIONS' ? void res.sendStatus(403) : next();
    res.setHeader('Access-Control-Allow-Origin', clientOrigin);
    if (req.method !== 'OPTIONS') return next();
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
    res.sendStatus(204);
  };
}

function sendError(res: express.Response, status: number, body: ApiError) {
  res.status(status).json(body);
}

// Body-size and JSON-parse errors are raised by the body parser before the validator;
// they are mapped to the same ApiError shape. No call was used, so no remainingCallsToday.
const bodyErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (err?.type === 'entity.too.large') {
    return sendError(res, 413, { error: 'validation_error', message: 'The request body is too large (limit 16 KB).' });
  }
  if (err?.type === 'entity.parse.failed') {
    return sendError(res, 400, { error: 'validation_error', message: 'The request body is not valid JSON.' });
  }
  next(err);
};

// Last resort: every error leaves as an ApiError, never Express's HTML page or a stack trace.
// Client errors raised by the body parser (for example 415 for an unsupported charset) keep their status.
// Only 5xx are logged, by name only: error messages can quote the request body (see task 5.4's logging rules).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const fallbackErrorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) {
    logError('unhandled error', err);
    return sendError(res, 500, { error: 'server_error', message: 'Something went wrong.' });
  }
  sendError(res, status, { error: 'validation_error', message: 'The request could not be read.' });
};

export function createApp(deps?: AppDeps) {
  const app = express();
  if (deps) app.use(cors(deps.clientOrigin)); // first, so error responses carry the header too
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/plan', express.json({ limit: BODY_LIMIT }), (req, res, next) => {
    const result = validateOnboarding(req.body);
    // The week is not part of the onboarding: it is read beside it. Only an absent key means "this week"; the clock is the
    // injected one, as for the cap and the coach.
    const raw: Record<string, unknown> = typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body) ? req.body : {};
    const week = validateWeekStart('weekStart' in raw ? raw.weekStart : undefined, todayUtc((deps?.now ?? (() => new Date()))()));
    if (!result.ok || !week.ok) {
      return sendError(res, 400, {
        error: 'validation_error',
        message: 'Some answers need fixing.',
        fields: { ...(result.ok ? {} : result.fields), ...(week.ok ? {} : { weekStart: week.message }) },
      });
    }
    if (!deps) {
      return sendError(res, 500, { error: 'server_error', message: 'The server is not configured.' }); // wired in task 5.4
    }
    generatePlan(deps, result.value, week.value)
      .then((outcome) => res.status(outcome.status).json(outcome.body))
      .catch(next); // also catches a failure while sending, so it never becomes an unhandled rejection
  });

  // The latest saved plan record, or JSON null. Never calls the coach and never touches the cap.
  app.get('/api/plan', async (_req, res) => {
    if (!deps) {
      return sendError(res, 500, { error: 'server_error', message: 'The server is not configured.' }); // wired in task 5.4
    }
    try {
      res.json(await deps.store.latest());
    } catch (err) {
      logError('reading the latest plan failed', err);
      sendError(res, 500, { error: 'server_error', message: 'Something went wrong.' });
    }
  });

  // Deletes one plan by id and answers 204. The id is a positive whole number without leading zeros and no larger than the
  // largest safe integer (a longer one would reach Postgres and fail as a 500). Never touches the cap or the coach.
  app.delete('/api/plan/:id', async (req, res) => {
    if (!deps) {
      return sendError(res, 500, { error: 'server_error', message: 'The server is not configured.' });
    }
    const raw = req.params.id ?? '';
    const id = Number(raw);
    if (!/^[1-9][0-9]*$/.test(raw) || !Number.isSafeInteger(id)) {
      return sendError(res, 400, { error: 'validation_error', message: 'The plan id must be a positive whole number.' });
    }
    try {
      if (!(await deps.store.delete(id))) return sendError(res, 404, { error: 'not_found', message: 'There is no such plan.' });
      res.status(204).end();
    } catch (err) {
      logError('deleting the plan failed', err);
      sendError(res, 500, { error: 'server_error', message: 'Something went wrong.' });
    }
  });

  app.use(bodyErrorHandler); // error handlers go after the routes
  app.use(fallbackErrorHandler);

  return app;
}
