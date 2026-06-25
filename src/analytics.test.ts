import { describe, expect, it } from 'vitest';
import {
  getExerciseProgress,
  getLastExerciseSets,
  getPersonalRecords,
  getWeeklyStats,
} from './analytics';
import type { SetLog, WorkoutSession } from './types';

function set(weight: number | null, reps: number | null, completed = true): SetLog {
  return { setNumber: 0, weight, reps, completed };
}

function session(id: string, date: string, exerciseId: string, sets: SetLog[]): WorkoutSession {
  return {
    id,
    date,
    planId: 'p',
    dayId: 'd',
    exerciseLogs: [{ exerciseId, note: '', sets: sets.map((s, i) => ({ ...s, setNumber: i + 1 })) }],
  };
}

describe('getExerciseProgress', () => {
  it('returns points sorted oldest to newest with max weight and total volume', () => {
    const sessions: WorkoutSession[] = [
      session('s2', '2026-06-10T08:00:00.000Z', 'bench', [set(60, 10), set(65, 8)]),
      session('s1', '2026-06-03T08:00:00.000Z', 'bench', [set(50, 10), set(55, 8)]),
    ];

    const progress = getExerciseProgress(sessions, 'bench');

    expect(progress).toHaveLength(2);
    expect(progress[0].sessionId).toBe('s1');
    expect(progress[0].maxWeight).toBe(55);
    expect(progress[0].totalVolume).toBe(50 * 10 + 55 * 8);
    expect(progress[1].maxWeight).toBe(65);
    expect(progress[1].totalVolume).toBe(60 * 10 + 65 * 8);
  });

  it('skips sessions without logged sets for the exercise', () => {
    const sessions: WorkoutSession[] = [
      session('s1', '2026-06-03T08:00:00.000Z', 'bench', [set(null, null, false)]),
      session('s2', '2026-06-10T08:00:00.000Z', 'squat', [set(80, 5)]),
    ];

    expect(getExerciseProgress(sessions, 'bench')).toHaveLength(0);
  });
});

describe('getPersonalRecords', () => {
  it('tracks best weight, best volume, session count and sorts by best weight desc', () => {
    const sessions: WorkoutSession[] = [
      session('s1', '2026-06-03T08:00:00.000Z', 'bench', [set(60, 10)]),
      session('s2', '2026-06-10T08:00:00.000Z', 'bench', [set(70, 8)]),
      session('s3', '2026-06-11T08:00:00.000Z', 'squat', [set(100, 5)]),
    ];

    const prs = getPersonalRecords(sessions);

    expect(prs[0].exerciseId).toBe('squat');
    expect(prs[0].bestWeight).toBe(100);

    const bench = prs.find((p) => p.exerciseId === 'bench');
    expect(bench?.bestWeight).toBe(70);
    expect(bench?.bestWeightDate).toBe('2026-06-10T08:00:00.000Z');
    expect(bench?.sessionCount).toBe(2);
    expect(bench?.bestVolume).toBe(60 * 10);
  });

  it('ignores empty sets', () => {
    const sessions: WorkoutSession[] = [
      session('s1', '2026-06-03T08:00:00.000Z', 'bench', [set(null, null, false)]),
    ];
    expect(getPersonalRecords(sessions)).toHaveLength(0);
  });
});

describe('getWeeklyStats', () => {
  it('splits sessions into recent and previous 7-day windows', () => {
    const now = new Date('2026-06-25T12:00:00.000Z');
    const sessions: WorkoutSession[] = [
      session('recent', '2026-06-24T08:00:00.000Z', 'bench', [set(60, 10)]),
      session('previous', '2026-06-15T08:00:00.000Z', 'bench', [set(50, 10)]),
      session('tooOld', '2026-06-01T08:00:00.000Z', 'bench', [set(40, 10)]),
    ];

    const stat = getWeeklyStats(sessions, now);

    expect(stat.recentSessions).toBe(1);
    expect(stat.recentCompletedSets).toBe(1);
    expect(stat.recentVolume).toBe(60 * 10);
    expect(stat.previousSessions).toBe(1);
    expect(stat.previousVolume).toBe(50 * 10);
  });
});

describe('getLastExerciseSets', () => {
  it('returns the most recent session sets for the exercise', () => {
    const sessions: WorkoutSession[] = [
      session('old', '2026-06-03T08:00:00.000Z', 'bench', [set(50, 10), set(55, 8)]),
      session('new', '2026-06-10T08:00:00.000Z', 'bench', [set(60, 10), set(65, 8)]),
    ];

    const refs = getLastExerciseSets(sessions, 'bench');

    expect(refs).toHaveLength(2);
    expect(refs[0]).toEqual({ weight: 60, reps: 10 });
    expect(refs[1]).toEqual({ weight: 65, reps: 8 });
  });

  it('returns empty array when no history exists', () => {
    expect(getLastExerciseSets([], 'bench')).toEqual([]);
  });
});
