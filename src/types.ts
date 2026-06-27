export type MuscleGroup =
  | '胸'
  | '背'
  | '腿'
  | '肩'
  | '三头'
  | '二头'
  | '核心'
  | '臀'
  | '全身';

export interface Exercise {
  id: string;
  name: string;
  muscleGroups: MuscleGroup[];
  equipment: string;
  cues: string[];
  commonMistakes: string[];
  planFit: string[];
}

export interface WarmupItem {
  name: string;
  detail: string;
}

export interface TrainingDayTemplate {
  id: string;
  name: string;
  focus: MuscleGroup[];
  sourceUrl: string;
  exerciseIds: string[];
  coachNotes: CoachExerciseNote[];
  warmup?: WarmupItem[];
}

export interface CoachPlan {
  id: string;
  coachName: string;
  title: string;
  description: string;
  sourceUrl: string;
  days: TrainingDayTemplate[];
  planType: 'builtin' | 'custom';
}

export interface CoachExerciseNote {
  exerciseId: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceBasis: string;
  goal: string;
  keyCues: string[];
  commonMistakes: string[];
  regression?: string;
  illustration: 'bench' | 'dip' | 'raise' | 'pull' | 'row' | 'curl' | 'squat' | 'hinge' | 'leg-machine' | 'calf';
  imageUrl?: string;
}

export interface SetLog {
  setNumber: number;
  weight: number | null;
  reps: number | null;
  completed: boolean;
}

export interface ExerciseLog {
  exerciseId: string;
  sets: SetLog[];
  note: string;
}

export interface WorkoutSession {
  id: string;
  date: string;
  planId: string;
  dayId: string;
  exerciseLogs: ExerciseLog[];
}
