import { Router } from 'express';

export function createCustomPlanRouter(customPlanStore) {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      res.json({ code: 0, data: await customPlanStore.list() });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      res.json({ code: 0, data: await customPlanStore.upsert(req.body) });
    } catch (error) {
      next(error);
    }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      res.json({ code: 0, data: await customPlanStore.upsert({ ...req.body, id: req.params.id }) });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      await customPlanStore.remove(req.params.id);
      res.json({ code: 0, data: { id: req.params.id } });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
