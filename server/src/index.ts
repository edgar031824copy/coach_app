import { createApp } from './app.js';
import { parseCallLimit } from './db/cap.js';

// An invalid MAX_COACH_CALLS_PER_DAY throws here, so the server refuses to start.
const callLimit = parseCallLimit(process.env.MAX_COACH_CALLS_PER_DAY);

const port = Number(process.env.PORT ?? 3000);
createApp().listen(port, () => {
  console.log(`server listening on ${port} (daily coach call limit: ${callLimit})`);
});
