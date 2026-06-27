import { Router } from 'express';
import { ensureSchema } from '../schema.js';

// 诊断接口：让后端自己报告它连的是哪个库、表是否存在、训练表实际行数，
// 并做一次「事务写入 → 同连接回读 → 跨连接回读 → 回滚」自检，
// 用于定位「保存返回 200 成功但数据查不到」这类问题。
export function createDiagnosticsRouter(pool) {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      await ensureSchema(pool);

      const [dbRows] = await pool.query(
        'SELECT DATABASE() AS db, @@hostname AS host, @@version AS version, CONNECTION_ID() AS conn',
      );
      const [tableRows] = await pool.query('SHOW TABLES');
      const tables = tableRows.map((row) => Object.values(row)[0]);

      const counts = {};
      for (const table of ['workout_sessions', 'workout_exercise_logs', 'workout_set_logs', 'user_preferences']) {
        try {
          const [[{ c }]] = await pool.query(`SELECT COUNT(*) AS c FROM \`${table}\``);
          counts[table] = c;
        } catch (error) {
          counts[table] = `ERROR: ${error.code || error.message}`;
        }
      }

      // 写入自检：用事务插一条临时 session，提交后用「另一条池连接」回读，最后删除。
      const probeId = `diag-probe-${Date.now()}`;
      const writeProbe = { committed: false, readBackFromPool: null, error: null };
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query(
          'INSERT INTO workout_sessions (id, date, plan_id, day_id) VALUES (?, ?, ?, ?)',
          [probeId, new Date().toISOString(), 'diag', 'diag'],
        );
        await connection.commit();
        writeProbe.committed = true;
      } catch (error) {
        await connection.rollback();
        writeProbe.error = `${error.code || ''} ${error.message}`;
      } finally {
        connection.release();
      }

      if (writeProbe.committed) {
        // 关键：用连接池里「另一条」连接回读，验证 commit 是否对其他连接可见。
        const [rows] = await pool.query('SELECT id FROM workout_sessions WHERE id = ?', [probeId]);
        writeProbe.readBackFromPool = rows.length;
        await pool.query('DELETE FROM workout_sessions WHERE id = ?', [probeId]);
      }

      res.json({
        code: 0,
        data: {
          connection: dbRows[0],
          tables,
          counts,
          writeProbe,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
