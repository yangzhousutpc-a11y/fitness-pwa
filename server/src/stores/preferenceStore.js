import { ensureSchema } from '../schema.js';

const currentPlanKey = 'current_plan_id';

export function createPreferenceStore(pool) {
  return {
    async getCurrentPlanId() {
      await ensureSchema(pool);
      const [rows] = await pool.query('SELECT preference_value FROM user_preferences WHERE preference_key = ?', [
        currentPlanKey,
      ]);
      return rows[0]?.preference_value ?? null;
    },

    async setCurrentPlanId(planId) {
      await ensureSchema(pool);
      await pool.query(
        `INSERT INTO user_preferences (preference_key, preference_value)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE preference_value = VALUES(preference_value)`,
        [currentPlanKey, planId],
      );
      return planId;
    },
  };
}
