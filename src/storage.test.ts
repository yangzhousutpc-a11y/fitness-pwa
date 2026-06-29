import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEmptyCustomPlan,
  createSessionFromDay,
  createSessionFromHistory,
  loadWorkoutDrafts,
  removeWorkoutDraft,
  saveWorkoutDraft,
} from './storage';
import { coachPlans } from './data';

describe('workout session factories', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-06-24T10:00:00+08:00'));
    localStorage.clear();
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

  it('preserves blank weights and reps when saving', () => {
    const session = createSessionFromDay(coachPlans[0], coachPlans[0].days[0]);

    expect(session.exerciseLogs[0].sets[0].weight).toBeNull();
    expect(session.exerciseLogs[0].sets[0].reps).toBeNull();
  });

  it('creates empty custom plans without reading localStorage', () => {
    localStorage.setItem('fitness-pwa.custom-plans.v1', JSON.stringify([{ id: 'old-local-plan' }]));

    const plan = createEmptyCustomPlan();

    expect(plan.id).toMatch(/^custom-plan-/);
    expect(plan.planType).toBe('custom');
    expect(plan.days).toHaveLength(1);
    expect(plan.days[0].exerciseIds).toEqual([]);
  });

  it('copies a historical session for today while resetting completion state', () => {
    const source = {
      id: 'session-old',
      date: '2026-06-20T08:00:00.000Z',
      planId: 'split-3-day',
      dayId: 'day-1',
      exerciseLogs: [
        {
          exerciseId: 'barbell-bench-press',
          note: '肩胛收紧',
          sets: [
            { setNumber: 1, weight: 50, reps: 15, completed: true },
            { setNumber: 2, weight: 55, reps: 12, completed: true },
          ],
        },
      ],
    };

    const copied = createSessionFromHistory(source);

    expect(copied.id).toMatch(/^session-/);
    expect(copied.id).not.toBe(source.id);
    expect(copied.date).toBe('2026-06-24T02:00:00.000Z');
    expect(copied.planId).toBe(source.planId);
    expect(copied.dayId).toBe(source.dayId);
    expect(copied.exerciseLogs).toEqual([
      {
        exerciseId: 'barbell-bench-press',
        note: '肩胛收紧',
        sets: [
          { setNumber: 1, weight: 50, reps: 15, completed: false },
          { setNumber: 2, weight: 55, reps: 12, completed: false },
        ],
      },
    ]);
  });

  it('persists and removes unfinished workout drafts separately from completed sessions', () => {
    const session = createSessionFromDay(coachPlans[0], coachPlans[0].days[0]);
    const draftKey = `${session.planId}:${session.dayId}`;

    expect(loadWorkoutDrafts()).toEqual({});

    saveWorkoutDraft(draftKey, session);

    expect(loadWorkoutDrafts()[draftKey]).toEqual(session);
    expect(localStorage.getItem('fitness-pwa.sessions.v1')).toBeNull();

    removeWorkoutDraft(draftKey);

    expect(loadWorkoutDrafts()[draftKey]).toBeUndefined();
  });

  it('ignores corrupted workout draft storage', () => {
    localStorage.setItem('fitness-pwa.workout-drafts.v1', '{not json');

    expect(loadWorkoutDrafts()).toEqual({});
  });

  it('ignores workout drafts with an invalid session shape', () => {
    localStorage.setItem(
      'fitness-pwa.workout-drafts.v1',
      JSON.stringify({
        'bad:day': { id: 'bad-draft', exerciseLogs: [{ exerciseId: 'barbell-bench-press' }] },
      }),
    );

    expect(loadWorkoutDrafts()).toEqual({});
  });
});
