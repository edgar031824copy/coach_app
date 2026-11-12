import { describe, it, expect, afterEach, vi } from 'vitest';
import { CoachOutputError, type CoachClient } from './coach/types.js';
import { appHarness } from '../test/app-harness.js';
import { PASTE, responseWith, session } from '../test/fixtures.js';

// Logs must never contain the injuries text, the pasted plan, or a plan (design.md section 9).
const INJURIES = 'SECRET-INJURY my left knee hurts';
const PLAN_TEXT = 'SECRET-PLAN-DESCRIPTION';
const PASTED = `Week 1: Mon 5 km SECRET-PASTE`;
const body = {
  goal: 'Run a half marathon', runningLevel: 'intermediate', crossfitLevel: 'beginner', injuries: INJURIES,
  runningDays: ['mon', 'wed'], crossfitDays: ['tue'],
};

let captured: string[] = [];
const capture = () => {
  captured = [];
  for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      captured.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a) + String((a as Error)?.stack ?? ''))).join(' '));
    });
  }
};
let h: Awaited<ReturnType<typeof appHarness>>;
afterEach(async () => {
  vi.restoreAllMocks();
  await h?.cleanup();
});

const secretsIn = () => captured.join('\n').match(/SECRET[-\w]*/g);

describe('logging never contains the athlete\'s text or a plan', () => {
  it('on success', async () => {
    const ok: CoachClient = {
      async generate() {
        return responseWith({ mon: [session('running', 'coach', 'easy', PLAN_TEXT)], tue: [session('crossfit')], wed: [session('running')] });
      },
    };
    h = await appHarness({ coach: ok });
    capture();
    expect((await h.post(body)).status).toBe(200);
    expect(secretsIn()).toBeNull();
  });

  it('when the coach fails with an error that quotes the athlete\'s text', async () => {
    const failing: CoachClient = {
      async generate(onboarding) {
        throw new Error(`upstream failure while reading: ${onboarding.injuries}`);
      },
    };
    h = await appHarness({ coach: failing });
    capture();
    expect((await h.post(body)).status).toBe(502);
    expect(captured.length).toBeGreaterThan(0); // the failure is logged ...
    expect(secretsIn()).toBeNull(); // ... without the text
  });

  it('when the coach returns an invalid or malformed answer containing plan text', async () => {
    for (const answer of [() => ({ junk: PLAN_TEXT }), () => { throw new CoachOutputError(`refused: ${INJURIES}`); }]) {
      h = await appHarness({ coach: { async generate() { return answer(); } } });
      capture();
      expect((await h.post(body)).status).toBe(422);
      expect(secretsIn()).toBeNull();
      await h.cleanup();
    }
    h = undefined as never;
  });

  it('when the cap or the store throws with the athlete\'s text in the message', async () => {
    const ok: CoachClient = { async generate() { return responseWith({ mon: [session('running')], tue: [session('crossfit')], wed: [session('running')] }); } };
    h = await appHarness({
      coach: ok,
      reserveCall: async () => { throw new Error(`cap broke ${INJURIES}`); },
    });
    capture();
    expect((await h.post(body)).status).toBe(500);
    expect(secretsIn()).toBeNull();
    await h.cleanup();

    h = await appHarness({
      coach: ok,
      store: { async save() { throw new Error(`save broke ${PLAN_TEXT}`); }, async latest() { throw new Error(`read broke ${PLAN_TEXT}`); } },
    });
    capture();
    expect((await h.post(body)).status).toBe(500);
    expect((await h.get()).status).toBe(500);
    expect(secretsIn()).toBeNull();
  });

  it('for a pasted plan, a bad body and an unhandled error', async () => {
    const readsPaste: CoachClient = { async generate(o) { throw new Error(`could not read ${o.existingRunningPlan}`); } };
    h = await appHarness({ coach: readsPaste });
    capture();
    await h.post({ ...body, runningDays: [], existingRunningPlan: PASTED });
    await h.post({ ...body, goal: '', injuries: INJURIES });
    await h.post(`{"injuries": "${INJURIES}", `); // unparseable body quoting the text
    expect(secretsIn()).toBeNull();
    expect(PASTE.length).toBeGreaterThan(0);
  });
});
