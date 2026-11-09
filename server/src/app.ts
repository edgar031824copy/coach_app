import express, { type ErrorRequestHandler } from 'express';
import type { ApiError } from 'shared';
import type { CoachClient } from './coach/types.js';
import { validateOnboarding } from './validation/onboarding.js';

// Everything the app needs from outside, so tests can inject fakes (design.md Decision 3 and 5).
export interface AppDeps {
  coach: CoachClient;
  // Atomic cap reservation (task 3.3): resolves to the day's call count after this call, or null when the cap is reached.
  reserveCall: () => Promise<number | null>;
}

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

export function createApp(deps?: AppDeps) {
  const app = express();
  app.locals.deps = deps; // consumed by the generation flow in task 5.1

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/plan', express.json({ limit: BODY_LIMIT }), (req, res) => {
    const result = validateOnboarding(req.body);
    if (!result.ok) {
      return sendError(res, 400, {
        error: 'validation_error',
        message: 'Some answers need fixing.',
        fields: result.fields,
      });
    }
    // Placeholder until task 5.1 (reserve a cap slot, call the coach, validate, save).
    sendError(res, 501, { error: 'server_error', message: 'Plan generation is not implemented yet.' });
  });

  app.use(bodyErrorHandler); // error handlers go after the routes

  return app;
}
