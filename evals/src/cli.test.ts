import { describe, it, expect } from 'vitest';
import { parseCliArgs } from './cli.js';

const IDS = ['clean-paste', 'pain-current', 'pain-mixed'];
const parse = (...argv: string[]) => parseCliArgs(argv, IDS);

describe('parseCliArgs', () => {
  it('defaults to the real coach, one repeat, every case, and no baseline write', () => {
    expect(parse()).toEqual({ ok: true, options: { coach: 'real', repeats: 1, only: null, model: null, writeBaseline: false, priceIn: null, priceOut: null } });
  });

  it('reads the options', () => {
    const r = parse('--repeats', '3', '--only', 'pain-current,pain-mixed', '--coach', 'real', '--model', 'claude-x', '--price-in', '1.5', '--price-out', '7');
    expect(r).toEqual({ ok: true, options: { coach: 'real', repeats: 3, only: ['pain-current', 'pain-mixed'], model: 'claude-x', writeBaseline: false, priceIn: 1.5, priceOut: 7 } });
    expect(parse('--repeats', '3', '--write-baseline')).toMatchObject({ ok: true, options: { writeBaseline: true, repeats: 3 } });
  });

  it('refuses a repeat count that is not a whole number from 1 to 5 (every call costs money)', () => {
    for (const bad of ['0', '-1', '2.5', 'abc', '6', '']) {
      const r = parse('--repeats', bad);
      expect(r.ok, bad).toBe(false);
      expect(!r.ok && r.error).toMatch(/repeats/i);
    }
  });

  it('refuses an unknown case id and lists the valid ones', () => {
    const r = parse('--only', 'clean-paste,nope');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain('nope');
    expect(!r.ok && r.error).toContain('clean-paste');
  });

  it('refuses an unknown coach, an unknown flag, and a bad price', () => {
    expect(parse('--coach', 'mock').ok).toBe(false);
    expect(parse('--bogus').ok).toBe(false);
    expect(parse('--price-in', '-1').ok).toBe(false);
    expect(parse('--price-out', 'free').ok).toBe(false);
  });

  it('does not write a baseline from a partial run: --only would replace the whole baseline with the chosen cases', () => {
    const r = parse('--only', 'pain-mixed', '--repeats', '3', '--write-baseline');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/--only/);
    expect(!r.ok && r.error).toMatch(/baseline/i);
    expect(parse('--only', 'pain-mixed', '--repeats', '3').ok).toBe(true); // a partial run is fine without --write-baseline
  });

  it('does not write a baseline from fewer than 3 repeats: one sample per case says little about flakiness', () => {
    for (const repeats of ['1', '2']) {
      const r = parse('--repeats', repeats, '--write-baseline');
      expect(r.ok, repeats).toBe(false);
      expect(!r.ok && r.error).toMatch(/3/);
    }
    expect(parse('--repeats', '3', '--write-baseline').ok).toBe(true);
    expect(parse('--repeats', '5', '--write-baseline').ok).toBe(true);
    expect(parse('--write-baseline').ok).toBe(false); // the default is 1 repeat
  });

  it('does not write a baseline from the fake coach, which is not the model', () => {
    const r = parse('--coach', 'fake', '--write-baseline');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/baseline/i);
  });
});
