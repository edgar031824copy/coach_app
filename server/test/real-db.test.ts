import { describe, it, expect } from 'vitest';
import { assertTestDatabase } from './real-db.js';

// The tests create and drop schemas, so they must never run against a real database.
describe('assertTestDatabase', () => {
  it.each([
    'postgres://localhost/coach_app_test',
    'postgres://postgres:postgres@localhost:5432/coach_app_test',
    'postgres://localhost/test',
  ])('accepts %s', (url) => {
    expect(() => assertTestDatabase(url)).not.toThrow();
  });

  it.each([
    'postgres://postgres:secret@db.example.supabase.co:5432/postgres',
    'postgres://localhost/coach_app',
    'postgres://localhost/',
  ])('refuses %s', (url) => {
    expect(() => assertTestDatabase(url)).toThrow(/test/);
  });
});
