import { Router } from 'express';

export function createWorkoutSessionRouter(workoutSessionStore) {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      res.json({ code: 0, data: await workoutSessionStore.list() });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      res.json({ code: 0, data: await workoutSessionStore.upsert(req.body) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
