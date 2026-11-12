// The only way the server logs a failure. It records where it happened and the error's NAME, never its message or
// stack: messages can quote the request (the injuries text, the pasted plan, a plan), and logs must never contain
// those (design.md section 9). Token usage logging (task 5.3) will follow the same rule: counts only.
export function logError(context: string, err: unknown): void {
  console.error(`${context}:`, err instanceof Error ? err.name : 'Error');
}
