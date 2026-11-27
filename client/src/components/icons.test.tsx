import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouteIcon, BarbellIcon, MoonIcon, WarningIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';

// Task 1.3: the icons are decoration. Text next to them carries the meaning, so a screen reader must skip them.
describe('icons', () => {
  const icons = { RouteIcon, BarbellIcon, MoonIcon, WarningIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon };

  it.each(Object.entries(icons))('%s is an inline svg hidden from assistive technology', (_name, Icon) => {
    const { container } = render(<Icon />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('focusable')).toBe('false');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it.each(Object.entries(icons))('%s takes its color from the text color and accepts a class', (_name, Icon) => {
    const { container } = render(<Icon className="size-5" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('stroke')).toBe('currentColor');
    expect(svg?.getAttribute('class')).toContain('size-5');
  });
});
