import type { CoachPlan, ExerciseLog, SetLog, TrainingDayTemplate, WorkoutSession } from './types';

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
    name: '自定义训练',
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
