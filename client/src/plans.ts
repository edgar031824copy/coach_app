import type { PlanRecord } from 'shared';

// The stored plans the page holds: one per week, ordered by `weekStart` from the oldest week (design.md Decision 4).
// Pure functions, so the rules are tested without React. None of them changes the list it is given.

// The plan the page opens on: the plan of the current week when there is one, else the plan made most recently (the
// highest id when creation times are equal).
export function pickStart(plans: PlanRecord[], currentMonday: string): PlanRecord | null {
  const current = plans.find((p) => p.weekStart === currentMonday);
  if (current) return current;
  let best: PlanRecord | null = null;
  for (const p of plans) {
    if (!best) { best = p; continue; }
    const diff = Date.parse(p.createdAt) - Date.parse(best.createdAt);
    if (diff > 0 || (diff === 0 && p.id > best.id)) best = p;
  }
  return best;
}

// A built plan joins the list: it takes the place of the plan of its week, or is inserted in week order.
export function withPlan(plans: PlanRecord[], record: PlanRecord): PlanRecord[] {
  const rest = plans.filter((p) => p.weekStart !== record.weekStart);
  const at = rest.findIndex((p) => p.weekStart > record.weekStart);
  return at === -1 ? [...rest, record] : [...rest.slice(0, at), record, ...rest.slice(at)];
}

export function without(plans: PlanRecord[], id: number): PlanRecord[] {
  return plans.filter((p) => p.id !== id);
}

// Where the page goes when plan `id` is deleted: the next later plan, else the previous one, else nothing. `plans` still
// holds the plan being deleted.
export function nearestAfter(plans: PlanRecord[], id: number): PlanRecord | null {
  const i = plans.findIndex((p) => p.id === id);
  if (i === -1) return null;
  return plans[i + 1] ?? plans[i - 1] ?? null;
}

// The switcher's step: the next later (+1) or earlier (-1) plan, null at an end or for an unknown plan.
export function neighbour(plans: PlanRecord[], id: number, step: 1 | -1): PlanRecord | null {
  const i = plans.findIndex((p) => p.id === id);
  if (i === -1) return null;
  return plans[i + step] ?? null;
}
