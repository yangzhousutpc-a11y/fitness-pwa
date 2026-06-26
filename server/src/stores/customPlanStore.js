import { ensureSchema } from '../schema.js';

function parseFocus(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return JSON.parse(value);
  }
  return [];
}

export function createCustomPlanStore(pool) {
  return {
    async list() {
      await ensureSchema(pool);
      const [planRows] = await pool.query('SELECT * FROM custom_plans ORDER BY created_at DESC');
      const [dayRows] = await pool.query('SELECT * FROM custom_plan_days ORDER BY sort_order ASC');
      const [exerciseRows] = await pool.query('SELECT * FROM custom_plan_day_exercises ORDER BY sort_order ASC');

      return planRows.map((plan) => {
        const days = dayRows
          .filter((day) => day.plan_id === plan.id)
          .map((day) => ({
            id: day.id,
            name: day.name,
            focus: parseFocus(day.focus_json),
            sourceUrl: day.source_url,
            exerciseIds: exerciseRows.filter((exercise) => exercise.day_id === day.id).map((exercise) => exercise.exercise_id),
            coachNotes: [],
          }));

        return {
          id: plan.id,
          coachName: plan.coach_name,
          title: plan.title,
          description: plan.description,
          sourceUrl: plan.source_url,
          planType: plan.plan_type,
          days,
        };
      });
    },

    async upsert(plan) {
      await ensureSchema(pool);
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query(
          `INSERT INTO custom_plans (id, coach_name, title, description, source_url, plan_type)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             coach_name = VALUES(coach_name),
             title = VALUES(title),
             description = VALUES(description),
             source_url = VALUES(source_url),
             plan_type = VALUES(plan_type)`,
          [plan.id, plan.coachName, plan.title, plan.description, plan.sourceUrl, plan.planType],
        );
        await connection.query('DELETE FROM custom_plan_days WHERE plan_id = ?', [plan.id]);

        for (const [dayIndex, day] of plan.days.entries()) {
          await connection.query(
            `INSERT INTO custom_plan_days (id, plan_id, name, focus_json, source_url, sort_order)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [day.id, plan.id, day.name, JSON.stringify(day.focus), day.sourceUrl, dayIndex],
          );

          for (const [exerciseIndex, exerciseId] of day.exerciseIds.entries()) {
            await connection.query(
              `INSERT INTO custom_plan_day_exercises (day_id, exercise_id, sort_order)
               VALUES (?, ?, ?)`,
              [day.id, exerciseId, exerciseIndex],
            );
          }
        }

        await connection.commit();
        return plan;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async remove(id) {
      await ensureSchema(pool);
      await pool.query('DELETE FROM custom_plans WHERE id = ?', [id]);
    },
  };
}
