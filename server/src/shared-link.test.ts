import { describe, it, expect } from 'vitest';
import { DaySchema, type Day } from 'shared';

// Guards the workspace link: the server resolves and compiles against `shared`.
describe('shared workspace link', () => {
  it('server code can import and use the shared schemas', () => {
    const day: Day = DaySchema.parse('fri');
    expect(day).toBe('fri');
  });
});
