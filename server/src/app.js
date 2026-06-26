import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { requireApiToken } from './auth.js';
import { pool } from './db.js';
import { createCustomPlanRouter } from './routes/customPlans.js';
import { createWorkoutSessionRouter } from './routes/workoutSessions.js';
import { createCustomPlanStore } from './stores/customPlanStore.js';
import { createWorkoutSessionStore } from './stores/workoutSessionStore.js';

function getClientError(error) {
  if (error?.code === 'ER_ACCESS_DENIED_ERROR') {
    return { status: 500, message: '数据库账号或密码错误，请检查 MYSQL_USER/MYSQL_PASSWORD' };
  }
  if (error?.code === 'ER_BAD_DB_ERROR') {
    return { status: 500, message: '数据库不存在，请检查 MYSQL_DATABASE' };
  }
  if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(error?.code)) {
    return { status: 500, message: '数据库连接失败，请检查 MYSQL_HOST/MYSQL_PORT' };
  }
  if (error?.code === 'ER_NO_SUCH_TABLE') {
    return { status: 500, message: '数据库表未初始化' };
  }
  return { status: 500, message: 'Internal Server Error' };
}

export function createApp({
  apiToken = process.env.API_TOKEN,
  customPlanStore = createCustomPlanStore(pool),
  staticDir = process.env.STATIC_DIR,
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
  app.use('/api', (_req, res) => {
    res.status(404).json({ code: 1, message: 'Not Found' });
  });

  if (staticDir) {
    app.use(express.static(staticDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  app.use((error, _req, res, _next) => {
    console.error(error);
    const clientError = getClientError(error);
    res.status(clientError.status).json({ code: 1, message: clientError.message });
  });

  return app;
}
