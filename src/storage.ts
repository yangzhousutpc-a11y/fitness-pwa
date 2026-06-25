import type { CoachPlan, ExerciseLog, SetLog, TrainingDayTemplate, WorkoutSession } from './types';

const storageKey = 'fitness-pwa.sessions.v1';
const customPlansKey = 'fitness-pwa.custom-plans.v1';
const defaultSetCount = 5;

export function createEmptySets(count = defaultSetCount): SetLog[] {
  return Array.from({ length: count }, (_, index) => ({
    setNumber: index + 1,
    weight: null,
    reps: null,
    completed: false,
  }));
}

export function createExerciseLog(exerciseId: string): ExerciseLog {
  return {
    exerciseId,
    note: '',
    sets: createEmptySets(),
  };
}

function createEmptyCustomDay(index = 1): TrainingDayTemplate {
  return {
    id: `custom-day-${index}`,
    name: `Day ${index}`,
    focus: ['全身'],
    sourceUrl: '',
    exerciseIds: [],
    coachNotes: [],
  };
}

export function createEmptyCustomPlan(): CoachPlan {
  const id = `custom-plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id,
    coachName: '自定义',
    title: '',
    description: '',
    sourceUrl: '',
    planType: 'custom',
    days: [createEmptyCustomDay()],
  };
}

export function loadCustomPlans(): CoachPlan[] {
  const raw = localStorage.getItem(customPlansKey);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomPlans(plans: CoachPlan[]): void {
  localStorage.setItem(customPlansKey, JSON.stringify(plans));
}

export function upsertCustomPlan(plan: CoachPlan): void {
  const existing = loadCustomPlans().filter((item) => item.id !== plan.id);
  saveCustomPlans([plan, ...existing]);
}

export function createSessionFromDay(plan: CoachPlan, day: TrainingDayTemplate): WorkoutSession {
  const now = new Date();
  const id = `session-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id,
    date: now.toISOString(),
    planId: plan.id,
    dayId: day.id,
    exerciseLogs: day.exerciseIds.map((exerciseId) => createExerciseLog(exerciseId)),
  };
}

export function loadSessions(): WorkoutSession[] {
  const raw = localStorage.getItem(storageKey);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSession(session: WorkoutSession): void {
  const existing = loadSessions().filter((item) => item.id !== session.id);
  const next = [session, ...existing];
  localStorage.setItem(storageKey, JSON.stringify(next));
}

export function clearSessions(): void {
  localStorage.removeItem(storageKey);
}
