import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';

// Task 1.1: the shadcn setup works end to end (alias, Tailwind plugin, class merging) when one component renders.
describe('Button (shadcn setup)', () => {
  it('renders an accessible button with its text and can be disabled', () => {
    render(<Button disabled>Build my plan</Button>);
    const button = screen.getByRole('button', { name: 'Build my plan' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('lets a caller class win over the variant class it conflicts with', () => {
    render(<Button variant="outline" className="h-12 w-full">Plan next week</Button>);
    const classes = screen.getByRole('button', { name: 'Plan next week' }).className.split(/\s+/);
    expect(classes).toContain('h-12');
    expect(classes).not.toContain('h-9'); // the default size's height is dropped by the merge
    expect(classes).toContain('border'); // the outline variant stays
  });
});
