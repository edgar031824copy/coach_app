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
    expect(classes).not.toContain('h-11'); // the default size's height is dropped by the merge
    expect(classes).toContain('border'); // the outline variant stays
  });

  // Task 1.3: tokens only, and the touch and mouse heights from the design (44 px touch, 36 px mouse).
  it('is 44 px high by default and 36 px with a mouse, in the primary color', () => {
    render(<Button>Build my plan</Button>);
    const classes = screen.getByRole('button', { name: 'Build my plan' }).className.split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining(['h-11', 'pointer-fine:h-9', 'bg-primary', 'text-primary-foreground']));
  });

  // Blending the accent with the page (hover:bg-primary/90) gave white text about 4.3:1; a token has a listed, tested pair.
  it('darkens the primary button on hover with the hover token, not by transparency', () => {
    render(<Button>Build my plan</Button>);
    const classes = screen.getByRole('button', { name: 'Build my plan' }).className.split(/\s+/);
    expect(classes).toContain('hover:bg-primary-hover');
    expect(classes.some((c) => /^hover:bg-primary\/\d+$/.test(c))).toBe(false);
  });

  it('has an outline and a secondary variant on the card and soft surfaces', () => {
    render(<><Button variant="outline">Outline</Button><Button variant="secondary">Secondary</Button></>);
    expect(screen.getByRole('button', { name: 'Outline' }).className).toContain('bg-card');
    expect(screen.getByRole('button', { name: 'Secondary' }).className).toContain('bg-secondary');
  });
});

// Task 2.4 (coach-plan-week-and-delete): the destructive action has its own variant, on the error token, with the same
// white text as the primary button; its pair is listed and computed in tokens.test.ts.
describe('Button: danger variant', () => {
  it('uses the error token with the on-accent text color, and no transparency blend', () => {
    render(<Button variant="danger">Yes, delete</Button>);
    const classes = screen.getByRole('button', { name: 'Yes, delete' }).className.split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining(['bg-error', 'border-error', 'text-primary-foreground']));
    expect(classes.some((c) => /^hover:bg-error\/\d+$/.test(c))).toBe(false); // a blend would lower the contrast of the white text
  });
});
