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

  router.delete('/:id', async (req, res, next) => {
    try {
      await workoutSessionStore.remove(req.params.id);
      res.json({ code: 0, data: { id: req.params.id } });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
