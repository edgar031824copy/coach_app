import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

// Task 1.3: the base components. Styling is Tailwind classes that point at tokens, so variants are checked by their
// token classes; behavior (names, typing, states) is checked through the accessibility tree.
const classesOf = (el: HTMLElement) => el.className.split(/\s+/);

describe('Card', () => {
  it('shows its children on a card surface', () => {
    render(<Card data-testid="card"><h3>Monday</h3></Card>);
    expect(screen.getByRole('heading', { name: 'Monday' })).toBeTruthy();
    expect(classesOf(screen.getByTestId('card'))).toEqual(expect.arrayContaining(['bg-card', 'border', 'rounded-xl', 'shadow-card']));
  });

  it('has a quieter variant for rest days: dashed, flat and see-through', () => {
    render(<Card variant="quiet" data-testid="card">Rest day</Card>);
    const classes = classesOf(screen.getByTestId('card'));
    expect(classes).toContain('border-dashed');
    expect(classes).not.toContain('shadow-card');
    expect(classes).not.toContain('bg-card');
  });

  it('lets a caller class win over the one it conflicts with', () => {
    render(<Card className="p-2" data-testid="card">x</Card>);
    const classes = classesOf(screen.getByTestId('card'));
    expect(classes).toContain('p-2');
    expect(classes).not.toContain('p-4');
  });
});

describe('Badge', () => {
  it('shows short text as a chip and keeps a caller class', () => {
    render(<Badge className="mr-2">from your plan</Badge>);
    const badge = screen.getByText('from your plan');
    expect(classesOf(badge)).toEqual(expect.arrayContaining(['rounded-sm', 'border', 'text-muted-foreground', 'mr-2']));
  });
});

describe('Alert', () => {
  it('passes its role and name through, so a safety note can be a note named "Safety note"', () => {
    render(<Alert variant="danger" role="note" aria-label="Safety note">Ease off this week.</Alert>);
    expect(screen.getByRole('note', { name: 'Safety note' }).textContent).toBe('Ease off this week.');
  });

  it('uses the alert tokens for danger and the soft surface otherwise', () => {
    render(<><Alert variant="danger" data-testid="danger">a</Alert><Alert data-testid="plain">b</Alert></>);
    expect(classesOf(screen.getByTestId('danger'))).toEqual(expect.arrayContaining(['bg-alert', 'border-alert-border', 'text-alert-foreground']));
    expect(classesOf(screen.getByTestId('plain'))).toEqual(expect.arrayContaining(['bg-secondary', 'border-border']));
    expect(classesOf(screen.getByTestId('plain'))).not.toContain('bg-alert');
  });
});

describe('Label, Input and Textarea', () => {
  it('give a field its accessible name through the label', () => {
    render(<><Label htmlFor="goal">Goal</Label><Textarea id="goal" /><Label htmlFor="week">Week</Label><Input id="week" /></>);
    expect(screen.getByRole('textbox', { name: 'Goal' }).tagName).toBe('TEXTAREA');
    expect(screen.getByRole('textbox', { name: 'Week' }).tagName).toBe('INPUT');
  });

  it('accept typing and report it through onChange', async () => {
    let seen = '';
    render(<Input aria-label="Name" onChange={(e) => { seen = e.target.value; }} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Ana');
    expect(seen).toBe('Ana');
  });

  it('show an invalid field and a disabled field as such', () => {
    render(<><Input aria-label="A" aria-invalid="true" /><Textarea aria-label="B" disabled /></>);
    expect(screen.getByRole('textbox', { name: 'A' }).getAttribute('aria-invalid')).toBe('true');
    expect((screen.getByRole('textbox', { name: 'B' }) as HTMLTextAreaElement).disabled).toBe(true);
  });

  it('use the error token for an invalid state and the touch and mouse heights', () => {
    render(<Input aria-label="A" />);
    const classes = classesOf(screen.getByRole('textbox', { name: 'A' }));
    expect(classes).toEqual(expect.arrayContaining(['aria-invalid:border-error', 'h-11', 'pointer-fine:h-9']));
  });
});
