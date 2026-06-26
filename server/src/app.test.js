import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import request from 'supertest';
import { createApp } from './app.js';

const samplePlan = {
  id: 'custom-plan-1',
  coachName: '自定义',
  title: '推日',
  description: '',
  sourceUrl: '',
  planType: 'custom',
  days: [
    {
      id: 'custom-day-1',
      name: '自定义训练',
      focus: ['胸'],
      sourceUrl: '',
      exerciseIds: ['barbell-bench-press'],
      coachNotes: [],
    },
  ],
};

const sampleSession = {
  id: 'session-1',
  date: '2026-06-26T08:00:00.000Z',
  planId: 'kaishengwang-tanchengyi-three-day-split',
  dayId: 'day-1-push',
  exerciseLogs: [
    {
      exerciseId: 'barbell-bench-press',
      note: '',
      sets: [{ setNumber: 1, weight: 60, reps: 10, completed: true }],
    },
  ],
};

function createMemoryStores() {
  const plans = new Map();
  const sessions = new Map();

  return {
    customPlanStore: {
      list: async () => [...plans.values()],
      upsert: async (plan) => {
        plans.set(plan.id, plan);
        return plan;
      },
      remove: async (id) => {
        plans.delete(id);
      },
    },
    workoutSessionStore: {
      list: async () => [...sessions.values()],
      upsert: async (session) => {
        sessions.set(session.id, session);
        return session;
      },
    },
  };
}

test('health endpoint does not require a token', async () => {
  const app = createApp({ ...createMemoryStores(), apiToken: 'secret-token' });

  const response = await request(app).get('/api/health').expect(200);

  assert.deepEqual(response.body, { code: 0, data: { status: 'ok' } });
});

test('business endpoints reject requests without the bearer token', async () => {
  const app = createApp({ ...createMemoryStores(), apiToken: 'secret-token' });

  const response = await request(app).get('/api/custom-plans').expect(401);

  assert.deepEqual(response.body, { code: 1, message: 'Unauthorized' });
});

test('custom plans round-trip through the API using the current frontend shape', async () => {
  const app = createApp({ ...createMemoryStores(), apiToken: 'secret-token' });
  const auth = { Authorization: 'Bearer secret-token' };

  await request(app).post('/api/custom-plans').set(auth).send(samplePlan).expect(200);
  const response = await request(app).get('/api/custom-plans').set(auth).expect(200);

  assert.deepEqual(response.body, { code: 0, data: [samplePlan] });
});

test('workout sessions round-trip through the API using the current frontend shape', async () => {
  const app = createApp({ ...createMemoryStores(), apiToken: 'secret-token' });
  const auth = { Authorization: 'Bearer secret-token' };

  await request(app).post('/api/workout-sessions').set(auth).send(sampleSession).expect(200);
  const response = await request(app).get('/api/workout-sessions').set(auth).expect(200);

  assert.deepEqual(response.body, { code: 0, data: [sampleSession] });
});

test('serves the built frontend shell when a static directory is configured', async () => {
  const staticDir = await mkdtemp(path.join(tmpdir(), 'fitness-pwa-static-'));

  try {
    await writeFile(path.join(staticDir, 'index.html'), '<!doctype html><title>Fitness PWA</title>');
    const app = createApp({ ...createMemoryStores(), apiToken: 'secret-token', staticDir });

    const response = await request(app).get('/workout/today').expect(200);

    assert.equal(response.text, '<!doctype html><title>Fitness PWA</title>');
  } finally {
    await rm(staticDir, { recursive: true, force: true });
  }
});
