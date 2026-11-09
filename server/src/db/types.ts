// The smallest thing pg's Client and Pool satisfy; the store and cap code depend on this, not on pg directly.
export interface Db {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}
