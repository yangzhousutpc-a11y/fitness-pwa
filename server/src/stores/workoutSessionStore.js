function normalizeWeight(weight) {
  if (weight === null || weight === undefined) {
    return null;
  }
  return Number(weight);
}

export function createWorkoutSessionStore(pool) {
  return {
    async list() {
      const [sessionRows] = await pool.query('SELECT * FROM workout_sessions ORDER BY date DESC');
      const [exerciseRows] = await pool.query('SELECT * FROM workout_exercise_logs ORDER BY sort_order ASC');
      const [setRows] = await pool.query('SELECT * FROM workout_set_logs ORDER BY set_number ASC');

      return sessionRows.map((session) => ({
        id: session.id,
        date: session.date,
        planId: session.plan_id,
        dayId: session.day_id,
        exerciseLogs: exerciseRows
          .filter((log) => log.session_id === session.id)
          .map((log) => ({
            exerciseId: log.exercise_id,
            note: log.note,
            sets: setRows
              .filter((set) => set.exercise_log_id === log.id)
              .map((set) => ({
                setNumber: set.set_number,
                weight: normalizeWeight(set.weight),
                reps: set.reps,
                completed: Boolean(set.completed),
              })),
          })),
      }));
    },

    async upsert(session) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query('DELETE FROM workout_sessions WHERE id = ?', [session.id]);
        await connection.query(
          'INSERT INTO workout_sessions (id, date, plan_id, day_id) VALUES (?, ?, ?, ?)',
          [session.id, session.date, session.planId, session.dayId],
        );

        for (const [exerciseIndex, log] of session.exerciseLogs.entries()) {
          const [result] = await connection.query(
            `INSERT INTO workout_exercise_logs (session_id, exercise_id, note, sort_order)
             VALUES (?, ?, ?, ?)`,
            [session.id, log.exerciseId, log.note, exerciseIndex],
          );

          for (const set of log.sets) {
            await connection.query(
              `INSERT INTO workout_set_logs (exercise_log_id, set_number, weight, reps, completed)
               VALUES (?, ?, ?, ?, ?)`,
              [result.insertId, set.setNumber, set.weight, set.reps, set.completed],
            );
          }
        }

        await connection.commit();
        return session;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
  };
}
