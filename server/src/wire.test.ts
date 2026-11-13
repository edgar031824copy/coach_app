import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { buildDeps } from './wire.js';
import { createApp } from './app.js';
import type { Config } from './config.js';
import { migratedClient } from '../test/real-db.js';

const config = (over: Partial<Config> = {}): Config => ({
  port: 3000, databaseUrl: 'postgres://unused', callLimit: 1, clientOrigin: 'https://app.example.com',
  coachModel: 'claude-sonnet-5-5', coachMode: 'fake', anthropicApiKey: undefined, production: false, ...over,
});
const body = {
  goal: 'Run a half marathon', runningLevel: 'intermediate', crossfitLevel: 'beginner', injuries: '',
  runningDays: ['mon', 'wed'], crossfitDays: ['tue'],
};

let db: Awaited<ReturnType<typeof migratedClient>>;
afterEach(() => db?.cleanup());

// The wiring used by index.ts: config + a database connection -> the app's dependencies.
describe('buildDeps', () => {
  it('connects the store, the cap and the client origin from the configuration', async () => {
    db = await migratedClient();
    const app = createApp(buildDeps(config({ callLimit: 1 }), db.client));

    const empty = await request(app).get('/api/plan').set('Origin', 'https://app.example.com');
    expect(empty.status).toBe(200);
    expect(empty.text).toBe('null');
    expect(empty.headers['access-control-allow-origin']).toBe('https://app.example.com');

    // Fake mode wires the fake coach (task 6.0): a valid request gets a plan, and it uses the configured cap:
    // with a limit of 1 the second request is refused.
    const first = await request(app).post('/api/plan').send(body);
    expect(first.status).toBe(200);
    expect(first.body.plan.days).toHaveLength(7);
    expect(first.body.remainingCallsToday).toBe(0);
    const second = await request(app).post('/api/plan').send(body);
    expect(second.status).toBe(429);

    const saved = await request(app).get('/api/plan');
    expect(saved.body.id).toBe(first.body.id);
  });
});
