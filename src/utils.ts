import { coachPlans } from './data';
import type { CoachExerciseNote, CoachPlan, Exercise, ExerciseLog, TrainingDayTemplate, WorkoutSession } from './types';

export type CalendarDay = {
  date: Date;
  dateKey: string;
  inCurrentMonth: boolean;
  sessions: WorkoutSession[];
};

const dailyTrainingQuotes = [
  '重量会说话，坚持会留下痕迹',
  '不是每天都轻松，但每组都算数',
  '把今天交给动作，把进步交给时间',
  '训练不靠情绪，靠一次次完成',
  '真正的变化，藏在下一组里',
  '少一点犹豫，多完成一组',
  '稳住节奏，身体会记住你的投入',
];

export function getDailyTrainingQuote(date = new Date()): string {
  const dayKey = date.getFullYear() * 372 + (date.getMonth() + 1) * 31 + date.getDate();
  return dailyTrainingQuotes[dayKey % dailyTrainingQuotes.length];
}

export function parseOptionalNumber(value: string): number | null {
  if (value.trim() === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeCustomPlan(plan: CoachPlan): CoachPlan {
  return {
    ...plan,
    days: [getUnifiedCustomDay(plan)],
  };
}

export function getUnifiedCustomDay(plan: CoachPlan): TrainingDayTemplate {
  const firstDay = plan.days[0];
  const exerciseIds = Array.from(new Set(plan.days.flatMap((day) => day.exerciseIds)));

  return {
    id: firstDay?.id ?? `${plan.id}-workout`,
    name: plan.title.trim() || '自定义训练',
    focus: firstDay?.focus.length ? firstDay.focus : ['全身'],
    sourceUrl: '',
    exerciseIds,
    coachNotes: [],
  };
}

export function groupSessionsByDate(sessions: WorkoutSession[]): Map<string, WorkoutSession[]> {
  const grouped = new Map<string, WorkoutSession[]>();

  for (const session of sessions) {
    const key = getDateKey(session.date);
    grouped.set(key, [...(grouped.get(key) ?? []), session]);
  }

  return grouped;
}

export function buildCalendarDays(monthDate: Date, sessionsByDate: Map<string, WorkoutSession[]>): CalendarDay[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const dateKey = getDateKey(date);

    return {
      date,
      dateKey,
      inCurrentMonth: date.getMonth() === month,
      sessions: sessionsByDate.get(dateKey) ?? [],
    };
  });
}

export function getNextWorkoutSuggestion(sessions: WorkoutSession[], customPlans: CoachPlan[]): string {
  const latest = [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  if (!latest) {
    return '';
  }

  const plan = [...coachPlans, ...customPlans].find((item) => item.id === latest.planId);
  if (!plan) {
    return '建议根据最近一次训练安排下一次';
  }

  if (plan.planType === 'custom') {
    return `可继续最近的自定义计划：${plan.title.trim() || '自定义训练'}`;
  }

  const currentIndex = plan.days.findIndex((day) => day.id === latest.dayId);
  if (currentIndex === -1 || plan.days.length === 0) {
    return '建议根据最近一次训练安排下一次';
  }

  const nextDay = plan.days[(currentIndex + 1) % plan.days.length];
  return `建议下一次练 ${nextDay.name}`;
}

export function getCalendarSessionLabel(session: WorkoutSession, customPlans: CoachPlan[]): string {
  const dayName = findDayName(session, customPlans);
  const dayMatch = dayName.match(/^Day\s+\d+/);
  if (dayMatch) {
    return dayMatch[0];
  }
  if (dayName.includes('自定义')) {
    return '自定义';
  }
  return dayName.slice(0, 3);
}

export function findDayName(session: WorkoutSession, customPlans: CoachPlan[]): string {
  const currentPlan = [...coachPlans, ...customPlans].find((item) => item.id === session.planId);
  return currentPlan?.days.find((day) => day.id === session.dayId)?.name ?? '训练记录';
}

export function findCoachNote(day: TrainingDayTemplate, exerciseId: string): CoachExerciseNote | undefined {
  return day.coachNotes.find((note) => note.exerciseId === exerciseId);
}

export function getCoachNoteForExercise(exerciseId: string): CoachExerciseNote | undefined {
  return coachPlans.flatMap((plan) => plan.days).flatMap((day) => day.coachNotes).find((note) => note.exerciseId === exerciseId);
}

export function getExerciseImageUrl(exerciseId: string): string {
  return exerciseImageUrls[exerciseId] ?? getCoachNoteForExercise(exerciseId)?.imageUrl ?? '';
}

export function getWorkoutDraftKey(planId: string, dayId: string): string {
  return `${planId}:${dayId}`;
}

export function getExerciseProfileGoal(exercise: Exercise, coachNote: CoachExerciseNote | undefined): string {
  return coachNote?.goal ?? exerciseProfileGoals[exercise.id] ?? `用${exercise.name}补充${exercise.muscleGroups.join('、')}训练容量。`;
}

const exerciseImageUrls: Record<string, string> = {
  'barbell-bench-press': '/coach-shots/bench-cue.jpg',
  'incline-dumbbell-press': '/coach-shots/incline-dumbbell-press-cue.jpg',
  'parallel-bar-dip': '/coach-shots/dip-cue.jpg',
  'skull-crusher': '/coach-shots/triceps-cue.jpg',
  'y-raise': '/coach-shots/raise-cue.jpg',
  'push-up': '/coach-shots/push-up-cue.jpg',
  'pull-up': '/coach-shots/pull-cue.jpg',
  'lat-pulldown': '/coach-shots/lat-pulldown-cue.jpg',
  'barbell-row': '/coach-shots/row-cue.jpg',
  'one-arm-dumbbell-row': '/coach-shots/one-arm-dumbbell-row-cue.jpg',
  'seated-cable-row': '/coach-shots/seated-cable-row-cue.jpg',
  'straight-arm-pulldown': '/coach-shots/straight-arm-pulldown-cue.jpg',
  'one-arm-lat-pulldown': '/coach-shots/one-arm-lat-pulldown-cue.jpg',
  'one-arm-cable-row': '/coach-shots/one-arm-cable-row-cue.jpg',
  'chest-supported-row': '/coach-shots/chest-supported-row-cue.jpg',
  'face-pull': '/coach-shots/face-pull-cue.jpg',
  'rear-delt-fly': '/coach-shots/rear-delt-fly-cue.jpg',
  'reverse-pec-deck': '/coach-shots/reverse-pec-deck-cue.jpg',
  'barbell-curl': '/coach-shots/curl-cue.jpg',
  'dumbbell-curl': '/coach-shots/dumbbell-curl-cue.jpg',
  'hammer-curl': '/coach-shots/hammer-curl-cue.jpg',
  'overhead-press': '/coach-shots/overhead-press-cue.jpg',
  'triceps-pushdown': '/coach-shots/triceps-pushdown-cue.jpg',
  'close-grip-bench': '/coach-shots/close-grip-bench-cue.jpg',
  'squat': '/coach-shots/squat-cue.jpg',
  'front-squat': '/coach-shots/front-squat-cue.jpg',
  'leg-press': '/coach-shots/leg-machine-cue.jpg',
  'single-leg-deadlift': '/coach-shots/single-leg-deadlift-cue.jpg',
  'romanian-deadlift': '/coach-shots/romanian-deadlift-cue.jpg',
  'deadlift': '/coach-shots/deadlift-cue.jpg',
  'leg-extension': '/coach-shots/leg-extension-cue.jpg',
  'leg-curl': '/coach-shots/leg-curl-cue.jpg',
  'walking-lunge': '/coach-shots/walking-lunge-cue.jpg',
  'bulgarian-split-squat': '/coach-shots/bulgarian-split-squat-cue.jpg',
  'hip-thrust': '/coach-shots/hip-thrust-cue.jpg',
  'back-extension': '/coach-shots/back-extension-cue.jpg',
  'standing-calf-raise': '/coach-shots/calf-cue.jpg',
  'plank': '/coach-shots/plank-cue.jpg',
  'hanging-leg-raise': '/coach-shots/hanging-leg-raise-cue.jpg',
  'cable-crunch': '/coach-shots/cable-crunch-cue.jpg',
  'farmer-carry': '/coach-shots/farmer-carry-cue.jpg',
  'kettlebell-swing': '/coach-shots/kettlebell-swing-cue.jpg',
  'ab-wheel-rollout': '/coach-shots/ab-wheel-rollout-cue.jpg',
  'dumbbell-fly': '/coach-shots/dumbbell-fly-cue.jpg',
  'cable-crossover': '/coach-shots/cable-crossover-cue.jpg',
  'dumbbell-shoulder-press': '/coach-shots/shoulder-press-cue.jpg',
  'lateral-raise': '/coach-shots/lateral-raise-cue.jpg',
  'cable-lateral-raise': '/coach-shots/cable-lateral-raise-cue.jpg',
};

const exerciseProfileGoals: Record<string, string> = {
  'push-up': '用自重推举补胸、三头和核心控制，适合作为热身、收尾或无器械训练。',
  'overhead-press': '用站姿推举建立肩部上举力量，同时训练核心抗后仰和全身稳定。',
  'one-arm-dumbbell-row': '用单侧划船补左右背部控制，减少强侧代偿并强化背阔肌收缩。',
  'front-squat': '用更直立的蹲姿强化股四头肌和核心支撑，补充深蹲以外的腿部刺激。',
  'single-leg-deadlift': '用单腿硬拉开发髋关节能力和单腿骨盆稳定，服务腿日后侧链训练。',
  'deadlift': '用传统硬拉整合腿、臀、背和握力，训练从地面发力的全身张力。',
  'walking-lunge': '用行走弓步补单腿稳定和臀腿协调，让左右侧力量更均衡。',
  'bulgarian-split-squat': '用分腿蹲集中刺激单侧臀腿，适合发现并修正左右力量差。',
  'hip-thrust': '用臀推把臀部伸髋单独拉出来，补足深蹲和硬拉之外的臀部发力。',
  'back-extension': '用山羊挺身补竖脊肌、臀和后侧链收紧能力，强化髋伸展控制。',
  'plank': '用平板支撑训练核心抗伸展能力，让躯干在推、拉、蹲中更稳定。',
  'hanging-leg-raise': '用悬垂举腿强化下腹卷起和骨盆控制，减少单纯甩腿代偿。',
  'cable-crunch': '用绳索卷腹给腹部稳定阻力，训练脊柱逐节卷曲和主动收缩。',
  'farmer-carry': '用负重行走整合握力、核心和肩胛稳定，提升全身抗侧屈能力。',
  'kettlebell-swing': '用壶铃摆荡训练髋部爆发和臀腿协同，不让动作变成蹲起或肩举。',
  'ab-wheel-rollout': '用健腹轮强化核心抗伸展和骨盆控制，逐步扩展可控活动范围。',
};

export function formatWeight(weight: number): string {
  const rounded = Math.round(weight * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}kg`;
}

export function formatSetLabel(weight: number, reps: number): string {
  return `${formatWeight(weight)} × ${reps}`;
}

export function formatVolume(volume: number): string {
  return `${Math.round(volume).toLocaleString('zh-CN')}kg`;
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

// 把 data.ts 里以 / 开头的静态资源路径拼上 Vite 的部署基路径，
// 以支持 GitHub Pages 子路径(/fitness-pwa/)。开发/测试环境 BASE_URL 为 /，结果不变。
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path}`;
}

export function formatDateShort(date: string): string {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(new Date(date));
}

export function formatMonthTitle(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' }).format(date);
}

export function formatDateForAria(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(date).replace('/', '月') + '日';
}

export function formatDateForDetail(dateKey: string): string {
  const [, month, day] = dateKey.split('-');
  return `${month}月${day}日`;
}

export function getDateKey(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function summarizeSession(session: WorkoutSession): string {
  const completedSets = session.exerciseLogs.flatMap((log: ExerciseLog) => log.sets).filter((set) => set.completed).length;
  const totalSets = session.exerciseLogs.flatMap((log: ExerciseLog) => log.sets).length;
  return `${session.exerciseLogs.length} 个动作 · ${completedSets}/${totalSets} 组完成`;
}

export function summarizeCalendarSession(session: WorkoutSession): string {
  const completedSets = session.exerciseLogs.flatMap((log: ExerciseLog) => log.sets).filter((set) => set.completed).length;
  const totalSets = session.exerciseLogs.flatMap((log: ExerciseLog) => log.sets).length;
  return `完成 ${completedSets}/${totalSets} 组 · ${session.exerciseLogs.length} 个动作`;
}
