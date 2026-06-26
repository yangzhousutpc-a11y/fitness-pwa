import cors from 'cors';
import express from 'express';
import { requireApiToken } from './auth.js';
import { pool } from './db.js';
import { createCustomPlanRouter } from './routes/customPlans.js';
import { createWorkoutSessionRouter } from './routes/workoutSessions.js';
import { createCustomPlanStore } from './stores/customPlanStore.js';
import { createWorkoutSessionStore } from './stores/workoutSessionStore.js';

export function createApp({
  apiToken = process.env.API_TOKEN,
  customPlanStore = createCustomPlanStore(pool),
  workoutSessionStore = createWorkoutSessionStore(pool),
} = {}) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ code: 0, data: { status: 'ok' } });
  });

  app.use('/api', requireApiToken(apiToken));
  app.use('/api/custom-plans', createCustomPlanRouter(customPlanStore));
  app.use('/api/workout-sessions', createWorkoutSessionRouter(workoutSessionStore));

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ code: 1, message: 'Internal Server Error' });
  });

  return app;
}
