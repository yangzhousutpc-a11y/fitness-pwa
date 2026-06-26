import { Router } from 'express';

export function createPreferenceRouter(preferenceStore) {
  const router = Router();

  router.get('/current-plan', async (_req, res, next) => {
    try {
      res.json({ code: 0, data: { planId: await preferenceStore.getCurrentPlanId() } });
    } catch (error) {
      next(error);
    }
  });

  router.put('/current-plan', async (req, res, next) => {
    try {
      const planId = typeof req.body?.planId === 'string' ? req.body.planId.trim() : '';
      if (!planId) {
        res.status(400).json({ code: 1, message: 'planId is required' });
        return;
      }

      res.json({ code: 0, data: { planId: await preferenceStore.setCurrentPlanId(planId) } });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
