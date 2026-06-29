import type { CoachPlan, ExerciseLog, SetLog, TrainingDayTemplate, WorkoutSession } from './types';

const defaultSetCount = 5;
const workoutDraftsKey = 'fitness-pwa.workout-drafts.v1';

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

export function createSessionFromHistory(sourceSession: WorkoutSession): WorkoutSession {
  const now = new Date();
  const id = `session-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id,
    date: now.toISOString(),
    planId: sourceSession.planId,
    dayId: sourceSession.dayId,
    exerciseLogs: sourceSession.exerciseLogs.map((log) => ({
      exerciseId: log.exerciseId,
      note: log.note,
      sets: log.sets.map((set) => ({
        setNumber: set.setNumber,
        weight: set.weight,
        reps: set.reps,
        completed: false,
      })),
    })),
  };
}

function isSetLog(value: unknown): value is SetLog {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const set = value as Partial<SetLog>;
  const hasValidWeight = set.weight === null || typeof set.weight === 'number';
  const hasValidReps = set.reps === null || typeof set.reps === 'number';
  return typeof set.setNumber === 'number' && hasValidWeight && hasValidReps && typeof set.completed === 'boolean';
}

function isExerciseLog(value: unknown): value is ExerciseLog {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const log = value as Partial<ExerciseLog>;
  return typeof log.exerciseId === 'string' && typeof log.note === 'string' && Array.isArray(log.sets) && log.sets.every(isSetLog);
}

function isWorkoutSession(value: unknown): value is WorkoutSession {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const session = value as Partial<WorkoutSession>;
  return (
    typeof session.id === 'string' &&
    typeof session.date === 'string' &&
    typeof session.planId === 'string' &&
    typeof session.dayId === 'string' &&
    Array.isArray(session.exerciseLogs) &&
    session.exerciseLogs.every(isExerciseLog)
  );
}

export function loadWorkoutDrafts(): Record<string, WorkoutSession> {
  try {
    const raw = localStorage.getItem(workoutDraftsKey);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => isWorkoutSession(value)),
    );
  } catch {
    return {};
  }
}

export function saveWorkoutDraft(draftKey: string, session: WorkoutSession): Record<string, WorkoutSession> {
  const drafts = { ...loadWorkoutDrafts(), [draftKey]: session };
  try {
    localStorage.setItem(workoutDraftsKey, JSON.stringify(drafts));
  } catch {
    // 草稿只用于防误退恢复；存储失败时不能打断正在训练的记录流程。
  }
  return drafts;
}

export function removeWorkoutDraft(draftKey: string): Record<string, WorkoutSession> {
  const drafts = { ...loadWorkoutDrafts() };
  delete drafts[draftKey];
  try {
    if (Object.keys(drafts).length === 0) {
      localStorage.removeItem(workoutDraftsKey);
    } else {
      localStorage.setItem(workoutDraftsKey, JSON.stringify(drafts));
    }
  } catch {
    // 清理失败不影响已完成训练提交。
  }
  return drafts;
}
