import type { ApiFailure } from './api.js';

export interface FailureNotice {
  message: string;
  canRetry: boolean; // show "Try again"
  limitNote: string | null; // "No retries remain today." when the failed call was the last allowed one
}

const NO_RETRIES = 'No retries remain today.';

// What the athlete reads for each way a request can fail (PRD principle 2: plain words), and whether a retry makes
// sense. A retry costs a call (the daily cap counts failed calls too), so it is hidden when none remain.
export function describeFailure(failure: ApiFailure): FailureNotice {
  if (failure.kind === 'network') return { message: 'Could not reach the server. Check your connection and try again.', canRetry: true, limitNote: null };
  // The client gave up waiting, but the server may still have finished: it is not certain that nothing was saved.
  if (failure.kind === 'timeout') {
    return { message: 'The coach took too long to answer. Your plan may still have been saved: reload the page to check, or try again.', canRetry: true, limitNote: null };
  }

  const { error, message, remainingCallsToday } = failure.error;
  const lastCallUsed = remainingCallsToday === 0;
  switch (error) {
    case 'not_found':
      return { message: 'The plan was not found.', canRetry: false, limitNote: null };
    case 'validation_error':
      return { message: 'Some answers need fixing. Check the highlighted fields.', canRetry: false, limitNote: null };
    case 'daily_limit_reached':
      return { message: 'Daily limit reached. The coach can build more plans tomorrow.', canRetry: false, limitNote: null };
    case 'plan_unreadable':
      return { message: `${message} Check the pasted plan and the week number${lastCallUsed ? '.' : ', then submit again.'}`, canRetry: false, limitNote: lastCallUsed ? NO_RETRIES : null };
    case 'coach_unavailable':
      return { message: 'The coach could not build your plan right now. Nothing was saved.', canRetry: !lastCallUsed, limitNote: lastCallUsed ? NO_RETRIES : null };
    case 'invalid_coach_response':
      return { message: 'The coach’s answer did not pass our checks, so nothing was saved.', canRetry: !lastCallUsed, limitNote: lastCallUsed ? NO_RETRIES : null };
    case 'server_error':
      return { message: 'Something went wrong on our side. Nothing was saved.', canRetry: !lastCallUsed, limitNote: lastCallUsed ? NO_RETRIES : null };
  }
}
