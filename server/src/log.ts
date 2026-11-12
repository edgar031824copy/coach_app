// The only way the server logs a failure. It records where it happened and the error's NAME, never its message or
// stack: messages can quote the request (the injuries text, the pasted plan, a plan), and logs must never contain
// those (design.md section 9). Token usage logging (task 5.3) will follow the same rule: counts only.
export function logError(context: string, err: unknown): void {
  console.error(`${context}:`, err instanceof Error ? err.name : 'Error');
}

// Token usage per coach call: numbers only (design.md Decision 3), so the first real runs give measured cost
// without ever logging a prompt or an answer.
export function logUsage(usage: {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}): void {
  console.log(
    'coach usage:',
    `input_tokens=${Number(usage.input_tokens)}`,
    `output_tokens=${Number(usage.output_tokens)}`,
    `cache_read_input_tokens=${Number(usage.cache_read_input_tokens ?? 0)}`,
    `cache_creation_input_tokens=${Number(usage.cache_creation_input_tokens ?? 0)}`,
  );
}
