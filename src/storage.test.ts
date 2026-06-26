import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyCustomPlan, createSessionFromDay } from './storage';
import { coachPlans } from './data';

describe('workout session factories', () => {
  beforeEach(() => {
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
});
