// WCAG 2.1 contrast ratio between two hexadecimal colors (`#rgb` or `#rrggbb`). Used by the token test only.
function channels(hex: string): number[] {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  const digits = m?.[1];
  if (!digits) throw new Error(`Not a hex color: ${hex}`);
  const full = digits.length === 3 ? [...digits].map((c) => c + c).join('') : digits;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
