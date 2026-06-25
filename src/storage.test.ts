import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSessionFromDay, loadSessions, saveSession } from './storage';
import { coachPlans } from './data';

describe('workout session storage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.setSystemTime(new Date('2026-06-24T10:00:00+08:00'));
  });

  it('creates a session with five empty sets for every planned exercise', () => {
    const day = coachPlans[0].days[0];
    const session = createSessionFromDay(coachPlans[0], day);

    expect(session.planId).toBe(coachPlans[0].id);
    expect(session.dayId).toBe(day.id);
    expect(session.exerciseLogs).toHaveLength(day.exerciseIds.length);
    expect(session.exerciseLogs[0].sets).toEqual([
      { setNumber: 1, weight: null, reps: null, completed: false },
      { setNumber: 2, weight: null, reps: null, completed: false },
      { setNumber: 3, weight: null, reps: null, completed: false },
      { setNumber: 4, weight: null, reps: null, completed: false },
      { setNumber: 5, weight: null, reps: null, completed: false },
    ]);
  });

  it('persists multiple sessions without overwriting old history', () => {
    const day = coachPlans[0].days[0];
    const first = createSessionFromDay(coachPlans[0], day);
    const second = createSessionFromDay(coachPlans[0], day);

    saveSession(first);
    saveSession(second);

    expect(loadSessions()).toHaveLength(2);
    expect(loadSessions().map((session) => session.id)).toEqual([second.id, first.id]);
  });

  it('preserves blank weights and reps when saving', () => {
    const session = createSessionFromDay(coachPlans[0], coachPlans[0].days[0]);

    saveSession(session);

    const saved = loadSessions()[0];
    expect(saved.exerciseLogs[0].sets[0].weight).toBeNull();
    expect(saved.exerciseLogs[0].sets[0].reps).toBeNull();
  });
});
