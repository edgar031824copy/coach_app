import { describe, it, expect } from 'vitest';
import { contrastRatio } from './contrast';

// Task 1.2: the contrast computation the token test relies on. Reference values come from the WCAG 2.1 definition
// (relative luminance, then (lighter + 0.05) / (darker + 0.05)).
describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for a color on itself', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#2563EB', '#2563EB')).toBeCloseTo(1, 5);
  });

  it('does not depend on which color is the text', () => {
    expect(contrastRatio('#FFFFFF', '#2563EB')).toBeCloseTo(contrastRatio('#2563EB', '#FFFFFF'), 10);
  });

  it('puts #767676 on white just above 4.5 and #777777 just below it (the known AA boundary)', () => {
    expect(contrastRatio('#767676', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeLessThan(4.5);
  });

  it('reads the short hexadecimal form', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5);
  });

  it('refuses a value that is not a hexadecimal color', () => {
    expect(() => contrastRatio('rgb(0, 0, 0)', '#FFFFFF')).toThrow(/hex/i);
  });
});
