import type { ExerciseLog, SetLog, WorkoutSession } from './types';

/** 一组有效数据的判定：填了重量且填了次数（completed 与否都计入，因为记录了就算练过）。 */
function isLoggedSet(set: SetLog): boolean {
  return set.weight !== null && set.weight > 0 && set.reps !== null && set.reps > 0;
}

/** 单组容量 = 重量 × 次数。 */
function setVolume(set: SetLog): number {
  if (!isLoggedSet(set)) {
    return 0;
  }
  return (set.weight as number) * (set.reps as number);
}

export interface ExerciseProgressPoint {
  sessionId: string;
  date: string;
  /** 当次训练该动作的最大重量。 */
  maxWeight: number;
  /** 当次训练该动作的总容量（∑ 重量 × 次数）。 */
  totalVolume: number;
}

/**
 * 取出某个动作在所有训练里的进度序列，按时间从早到晚排序。
 * 只纳入「至少有一组有效数据」的训练。
 */
export function getExerciseProgress(sessions: WorkoutSession[], exerciseId: string): ExerciseProgressPoint[] {
  const points: ExerciseProgressPoint[] = [];

  for (const session of sessions) {
    const log = session.exerciseLogs.find((item) => item.exerciseId === exerciseId);
    if (!log) {
      continue;
    }

    const loggedSets = log.sets.filter(isLoggedSet);
    if (loggedSets.length === 0) {
      continue;
    }

    const maxWeight = Math.max(...loggedSets.map((set) => set.weight as number));
    const totalVolume = loggedSets.reduce((sum, set) => sum + setVolume(set), 0);

    points.push({ sessionId: session.id, date: session.date, maxWeight, totalVolume });
  }

  return points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export interface ExercisePR {
  exerciseId: string;
  /** 历史最大单组重量。 */
  bestWeight: number;
  /** 历史单次训练最大容量。 */
  bestVolume: number;
  /** 出现 bestWeight 的训练日期。 */
  bestWeightDate: string;
  /** 该动作累计训练次数（有有效数据的训练）。 */
  sessionCount: number;
}

/**
 * 计算所有练过的动作的个人最好成绩（PR）。
 * 返回按 bestWeight 降序排序，便于优先展示重量最大的动作。
 */
export function getPersonalRecords(sessions: WorkoutSession[]): ExercisePR[] {
  const byExercise = new Map<string, ExercisePR>();

  for (const session of sessions) {
    for (const log of session.exerciseLogs) {
      const loggedSets = log.sets.filter(isLoggedSet);
      if (loggedSets.length === 0) {
        continue;
      }

      const maxWeight = Math.max(...loggedSets.map((set) => set.weight as number));
      const volume = loggedSets.reduce((sum, set) => sum + setVolume(set), 0);
      const current = byExercise.get(log.exerciseId);

      if (!current) {
        byExercise.set(log.exerciseId, {
          exerciseId: log.exerciseId,
          bestWeight: maxWeight,
          bestVolume: volume,
          bestWeightDate: session.date,
          sessionCount: 1,
        });
        continue;
      }

      current.sessionCount += 1;
      current.bestVolume = Math.max(current.bestVolume, volume);
      if (maxWeight > current.bestWeight) {
        current.bestWeight = maxWeight;
        current.bestWeightDate = session.date;
      }
    }
  }

  return [...byExercise.values()].sort((a, b) => b.bestWeight - a.bestWeight);
}

export interface WeeklyStat {
  /** 最近 7 天（含今天）的窗口。 */
  recentSessions: number;
  recentCompletedSets: number;
  recentVolume: number;
  /** 上一个 7 天窗口，用于环比。 */
  previousSessions: number;
  previousCompletedSets: number;
  previousVolume: number;
}

/**
 * 以 now 为基准，统计最近 7 天与上一个 7 天的训练量。
 * now 作为参数注入，便于测试。
 */
export function getWeeklyStats(sessions: WorkoutSession[], now: Date = new Date()): WeeklyStat {
  const dayMs = 24 * 60 * 60 * 1000;
  const recentStart = now.getTime() - 7 * dayMs;
  const previousStart = now.getTime() - 14 * dayMs;

  const stat: WeeklyStat = {
    recentSessions: 0,
    recentCompletedSets: 0,
    recentVolume: 0,
    previousSessions: 0,
    previousCompletedSets: 0,
    previousVolume: 0,
  };

  for (const session of sessions) {
    const time = new Date(session.date).getTime();
    const completedSets = countCompletedSets(session.exerciseLogs);
    const volume = sumVolume(session.exerciseLogs);

    if (time >= recentStart && time <= now.getTime()) {
      stat.recentSessions += 1;
      stat.recentCompletedSets += completedSets;
      stat.recentVolume += volume;
    } else if (time >= previousStart && time < recentStart) {
      stat.previousSessions += 1;
      stat.previousCompletedSets += completedSets;
      stat.previousVolume += volume;
    }
  }

  return stat;
}

function countCompletedSets(logs: ExerciseLog[]): number {
  return logs.flatMap((log) => log.sets).filter((set) => set.completed).length;
}

function sumVolume(logs: ExerciseLog[]): number {
  return logs.flatMap((log) => log.sets).reduce((sum, set) => sum + setVolume(set), 0);
}

export interface LastSetReference {
  weight: number | null;
  reps: number | null;
}

/**
 * 查某个动作上一次（最近一次）训练里逐组的重量/次数，用于本次训练自动带入参考。
 * 返回按组序排列的参考值；找不到历史返回空数组。
 */
export function getLastExerciseSets(sessions: WorkoutSession[], exerciseId: string): LastSetReference[] {
  const sorted = [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  for (const session of sorted) {
    const log = session.exerciseLogs.find((item) => item.exerciseId === exerciseId);
    if (!log) {
      continue;
    }

    const hasData = log.sets.some(isLoggedSet);
    if (!hasData) {
      continue;
    }

    return log.sets.map((set) => ({ weight: set.weight, reps: set.reps }));
  }

  return [];
}
