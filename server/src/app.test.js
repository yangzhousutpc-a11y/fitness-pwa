import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import request from 'supertest';
import { createApp } from './app.js';
import { createCustomPlanStore } from './stores/customPlanStore.js';

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
  let currentPlanId = null;

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
      remove: async (id) => {
        sessions.delete(id);
      },
    },
    preferenceStore: {
      getCurrentPlanId: async () => currentPlanId,
      setCurrentPlanId: async (planId) => {
        currentPlanId = planId;
        return currentPlanId;
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
  await request(app).delete('/api/workout-sessions/session-1').expect(401);

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

test('workout sessions can be deleted through the API', async () => {
  const app = createApp({ ...createMemoryStores(), apiToken: 'secret-token' });
  const auth = { Authorization: 'Bearer secret-token' };

  await request(app).post('/api/workout-sessions').set(auth).send(sampleSession).expect(200);
  const deleteResponse = await request(app).delete('/api/workout-sessions/session-1').set(auth).expect(200);
  const listResponse = await request(app).get('/api/workout-sessions').set(auth).expect(200);

  assert.deepEqual(deleteResponse.body, { code: 0, data: { id: 'session-1' } });
  assert.deepEqual(listResponse.body, { code: 0, data: [] });
});

test('rejects a malformed workout session with 400 instead of 500', async () => {
  const app = createApp({ ...createMemoryStores(), apiToken: 'secret-token' });
  const auth = { Authorization: 'Bearer secret-token' };

  const response = await request(app).post('/api/workout-sessions').set(auth).send({ id: '' }).expect(400);

  assert.equal(response.body.code, 1);
  assert.match(response.body.message, /不能为空|必须/);

  // 非法的 set.weight（字符串）必须被拦下，避免 Number("abc")=NaN 入库
  const badWeight = await request(app)
    .post('/api/workout-sessions')
    .set(auth)
    .send({
      ...sampleSession,
      exerciseLogs: [{ exerciseId: 'x', note: '', sets: [{ setNumber: 1, weight: 'abc', reps: 10, completed: true }] }],
    })
    .expect(400);
  assert.match(badWeight.body.message, /weight/);

  // completed 缺失/非布尔也必须拦下
  const badCompleted = await request(app)
    .post('/api/workout-sessions')
    .set(auth)
    .send({
      ...sampleSession,
      exerciseLogs: [{ exerciseId: 'x', note: '', sets: [{ setNumber: 1, weight: 60, reps: 10 }] }],
    })
    .expect(400);
  assert.match(badCompleted.body.message, /completed/);

  // note 缺失也必须拦下（store 会用它绑定，undefined 会炸 500）
  const badNote = await request(app)
    .post('/api/workout-sessions')
    .set(auth)
    .send({
      ...sampleSession,
      exerciseLogs: [{ exerciseId: 'x', sets: [{ setNumber: 1, weight: 60, reps: 10, completed: true }] }],
    })
    .expect(400);
  assert.match(badNote.body.message, /note/);
});

test('rejects a malformed custom plan with 400 instead of 500', async () => {
  const app = createApp({ ...createMemoryStores(), apiToken: 'secret-token' });
  const auth = { Authorization: 'Bearer secret-token' };

  const response = await request(app).post('/api/custom-plans').set(auth).send({ id: 'p1' }).expect(400);
  assert.equal(response.body.code, 1);

  // days 字段类型错误也应被拦成 400，而不是入库时炸成 500
  const badDays = await request(app)
    .post('/api/custom-plans')
    .set(auth)
    .send({ ...samplePlan, days: 'not-an-array' })
    .expect(400);
  assert.match(badDays.body.message, /days/);
});

test('current follow plan preference round-trips through the API', async () => {
  const app = createApp({ ...createMemoryStores(), apiToken: 'secret-token' });
  const auth = { Authorization: 'Bearer secret-token' };

  const initialResponse = await request(app).get('/api/preferences/current-plan').set(auth).expect(200);
  const saveResponse = await request(app)
    .put('/api/preferences/current-plan')
    .set(auth)
    .send({ planId: 'tanchengyi-private-coaching-follow-along' })
    .expect(200);
  const nextResponse = await request(app).get('/api/preferences/current-plan').set(auth).expect(200);

  assert.deepEqual(initialResponse.body, { code: 0, data: { planId: null } });
  assert.deepEqual(saveResponse.body, { code: 0, data: { planId: 'tanchengyi-private-coaching-follow-along' } });
  assert.deepEqual(nextResponse.body, { code: 0, data: { planId: 'tanchengyi-private-coaching-follow-along' } });
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

test('initializes database tables before reading custom plans', async () => {
  const queries = [];
  const store = createCustomPlanStore({
    query: async (sql) => {
      queries.push(sql);
      if (sql.startsWith('SELECT * FROM custom_plans')) {
        return [[]];
      }
      if (sql.startsWith('SELECT * FROM custom_plan_days')) {
        return [[]];
      }
      if (sql.startsWith('SELECT * FROM custom_plan_day_exercises')) {
        return [[]];
      }
      return [{}];
    },
  });

  const plans = await store.list();

  assert.deepEqual(plans, []);
  assert.ok(queries.some((sql) => sql.startsWith('CREATE TABLE IF NOT EXISTS custom_plans')));
  assert.ok(queries.some((sql) => sql.startsWith('SELECT * FROM custom_plans')));
});

test('returns a clear database connection error message', async () => {
  const app = createApp({
    ...createMemoryStores(),
    apiToken: 'secret-token',
    customPlanStore: {
      list: async () => {
        const error = new Error('connect failed');
        error.code = 'ECONNREFUSED';
        throw error;
      },
    },
  });

  const response = await request(app)
    .get('/api/custom-plans')
    .set({ Authorization: 'Bearer secret-token' })
    .expect(500);

  assert.deepEqual(response.body, { code: 1, message: '数据库连接失败，请检查 MYSQL_HOST/MYSQL_PORT' });
});
