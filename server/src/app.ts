import express, { type ErrorRequestHandler } from 'express';
import type { ApiError } from 'shared';
import { generatePlan, type GenerateDeps } from './generate-plan.js';
import { validateOnboarding } from './validation/onboarding.js';

export type AppDeps = GenerateDeps;

const BODY_LIMIT = '16kb'; // 🔶 specs/onboarding, free-text length limits

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
    console.error('unhandled error:', err?.name ?? 'Error');
    return sendError(res, 500, { error: 'server_error', message: 'Something went wrong.' });
  }
  sendError(res, status, { error: 'validation_error', message: 'The request could not be read.' });
};

export function createApp(deps?: AppDeps) {
  const app = express();
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/plan', express.json({ limit: BODY_LIMIT }), (req, res, next) => {
    const result = validateOnboarding(req.body);
    if (!result.ok) {
      return sendError(res, 400, {
        error: 'validation_error',
        message: 'Some answers need fixing.',
        fields: result.fields,
      });
    }
    if (!deps) {
      return sendError(res, 500, { error: 'server_error', message: 'The server is not configured.' }); // wired in task 5.4
    }
    generatePlan(deps, result.value).then(
      (outcome) => res.status(outcome.status).json(outcome.body),
      next,
    );
  });

  // The latest saved plan record, or JSON null. Never calls the coach and never touches the cap.
  app.get('/api/plan', async (_req, res) => {
    if (!deps) {
      return sendError(res, 500, { error: 'server_error', message: 'The server is not configured.' }); // wired in task 5.4
    }
    try {
      res.json(await deps.store.latest());
    } catch (err) {
      console.error('reading the latest plan failed:', (err as Error)?.name);
      sendError(res, 500, { error: 'server_error', message: 'Something went wrong.' });
    }
  });

  app.use(bodyErrorHandler); // error handlers go after the routes
  app.use(fallbackErrorHandler);

  return app;
}
