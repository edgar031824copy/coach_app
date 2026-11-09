import { it, expect } from 'vitest';

// Deliberately failing: proves ci-complete goes red. Reverted right after.
it('deliberate failure', () => {
  expect(1).toBe(2);
});
