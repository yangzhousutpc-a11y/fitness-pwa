import { describe, expect, it } from 'vitest';
import { coachPlans, exercises, filterExercises, getExerciseById, searchExercises } from './data';

describe('built-in fitness data', () => {
  it('ships an approximately 40 exercise library covering major strength training groups', () => {
    expect(exercises.length).toBeGreaterThanOrEqual(40);
    expect(exercises.some((exercise) => exercise.muscleGroups.includes('胸'))).toBe(true);
    expect(exercises.some((exercise) => exercise.muscleGroups.includes('背'))).toBe(true);
    expect(exercises.some((exercise) => exercise.muscleGroups.includes('腿'))).toBe(true);
    expect(exercises.some((exercise) => exercise.muscleGroups.includes('肩'))).toBe(true);
    expect(exercises.some((exercise) => exercise.muscleGroups.includes('核心'))).toBe(true);
  });

  it('defines the Kaisheng Wang Tan Chengyi three-day split skeleton', () => {
    const plan = coachPlans[0];

    expect(plan.coachName).toBe('凯圣王-谭成义');
    expect(plan.days.map((day) => day.name)).toEqual([
      'Day 1 胸 / 肩 / 三头',
      'Day 2 背 / 后束 / 二头',
      'Day 3 腿部',
    ]);
    expect(plan.sourceUrl).toContain('bilibili.com/video/BV17ooLBUEqS');
    expect(plan.sourceUrl).toContain('p=5');
    expect(plan.days.every((day) => day.sourceUrl.includes('bilibili.com/video/'))).toBe(true);
  });

  it('uses transcript-confirmed follow-along exercise lists and warmups for the three-day split', () => {
    const dayOne = coachPlans[0].days.find((day) => day.id === 'day-1-push');
    const dayTwo = coachPlans[0].days.find((day) => day.id === 'day-2-pull');
    const dayThree = coachPlans[0].days.find((day) => day.id === 'day-3-legs');

    expect(dayOne?.exerciseIds).toEqual([
      'barbell-bench-press',
      'incline-dumbbell-press',
      'parallel-bar-dip',
      'skull-crusher',
      'y-raise',
    ]);
    expect(dayTwo?.exerciseIds).toEqual([
      'one-arm-lat-pulldown',
      'lat-pulldown',
      'one-arm-cable-row',
      'chest-supported-row',
      'cable-curl',
    ]);
    expect(dayThree?.exerciseIds).toEqual([
      'standing-calf-raise',
      'hip-adduction-machine',
      'bulgarian-split-squat',
      'romanian-deadlift',
      'seated-hip-flexion-raise',
      'leg-curl',
    ]);
    expect(coachPlans[0].days.every((day) => (day.warmup?.length ?? 0) > 0)).toBe(true);
    expect(coachPlans[0].days.flatMap((day) => day.coachNotes).every((note) => note.sourceBasis.includes('逐字稿提炼'))).toBe(true);
  });

  it('defines the Tan Chengyi private coaching follow-along plan from five public videos', () => {
    const plan = coachPlans.find((item) => item.id === 'tanchengyi-private-coaching-follow-along');
    const legsDay = plan?.days.find((day) => day.id === 'private-day-5-legs');

    expect(plan?.coachName).toBe('谭成义');
    expect(plan?.title).toBe('谭成义私教跟练');
    expect(plan?.days.map((day) => day.name)).toEqual(['Day 1 背部', 'Day 2 手臂', 'Day 3 胸部', 'Day 4 肩部', 'Day 5 腿部']);
    expect(plan?.days.map((day) => day.sourceUrl)).toEqual([
      'https://www.bilibili.com/video/BV1HR7o6CE8q/',
      'https://www.bilibili.com/video/BV1GzEg6wEVb/',
      'https://www.bilibili.com/video/BV1ZxEk6cEv1/',
      'https://www.bilibili.com/video/BV1csj36CEf9/',
      'https://www.bilibili.com/video/BV1RjTT6FEKo/',
    ]);
    expect(legsDay?.warmup?.length).toBeGreaterThanOrEqual(4);
    expect(legsDay?.exerciseIds).toEqual([
      'standing-calf-raise',
      'hip-adduction-machine',
      'bulgarian-split-squat',
      'romanian-deadlift',
      'seated-hip-flexion-raise',
      'leg-curl',
    ]);
    expect(legsDay?.coachNotes.every((note) => note.sourceBasis.includes('腿部私教逐字稿提炼'))).toBe(true);

    for (const day of plan?.days ?? []) {
      expect(day.coachNotes).toHaveLength(day.exerciseIds.length);
      expect(day.coachNotes.every((note) => note.sourceBasis.includes('逐字稿提炼'))).toBe(true);
    }
  });

  it('attaches concise coach follow-along notes to every planned exercise', () => {
    const exerciseIds = new Set(exercises.map((exercise) => exercise.id));

    for (const plan of coachPlans) {
      for (const day of plan.days) {
        expect(day.coachNotes).toHaveLength(day.exerciseIds.length);

        for (const note of day.coachNotes) {
          expect(exerciseIds.has(note.exerciseId)).toBe(true);
          expect(day.exerciseIds).toContain(note.exerciseId);
          expect(note.sourceUrl).toContain('bilibili.com/video/');
          expect(note.keyCues.length).toBeGreaterThanOrEqual(3);
          expect(note.commonMistakes.length).toBeGreaterThanOrEqual(2);
          expect(note.illustration).toMatch(/^(bench|dip|raise|pull|row|curl|squat|hinge|leg-machine|calf)$/);
          expect(note.imageUrl).toMatch(/^\/coach-shots\/.+\.jpg$/);
        }
      }
    }
  });

  it('gives every exercise a unique coach cue image within each day', () => {
    for (const plan of coachPlans) {
      for (const day of plan.days) {
        const images = day.coachNotes.map((note) => note.imageUrl);
        expect(new Set(images).size).toBe(images.length);
      }
    }
  });

  it('only references exercises that exist in the library', () => {
    const ids = new Set(exercises.map((exercise) => exercise.id));
    const referencedIds = coachPlans.flatMap((plan) => plan.days.flatMap((day) => day.exerciseIds));

    expect(referencedIds.length).toBeGreaterThan(0);
    expect(referencedIds.every((id) => ids.has(id))).toBe(true);
  });

  it('searches by name, muscle group, and equipment', () => {
    expect(searchExercises('卧推').map((exercise) => exercise.name)).toContain('杠铃卧推');
    expect(searchExercises('背').length).toBeGreaterThan(4);
    expect(searchExercises('哑铃').length).toBeGreaterThan(4);
  });

  it('filters exercises by visible library filter labels', () => {
    expect(filterExercises('', '全部')).toHaveLength(exercises.length);
    expect(filterExercises('', '胸').every((exercise) => exercise.muscleGroups.includes('胸'))).toBe(true);
    expect(
      filterExercises('', '手臂').every(
        (exercise) => exercise.muscleGroups.includes('二头') || exercise.muscleGroups.includes('三头'),
      ),
    ).toBe(true);
    expect(filterExercises('卧推', '胸').map((exercise) => exercise.name)).toContain('杠铃卧推');
    expect(filterExercises('深蹲', '胸')).toHaveLength(0);
  });

  it('does not ship user-facing caveat copy inside coach notes', () => {
    const notes = coachPlans.flatMap((currentPlan) => currentPlan.days.flatMap((day) => day.coachNotes));
    const combined = [
      ...coachPlans.map((currentPlan) => currentPlan.description),
      ...notes.map((note) => Object.values(note).join(' ')),
    ].join(' ');

    expect(combined).not.toContain('非字幕逐字稿');
    expect(combined).not.toContain('通用跟练摘要');
    expect(combined).not.toContain('公开接口无字幕');
    expect(combined).not.toContain('公开视频入口可确认动作列表');
    expect(combined).not.toContain('公开页面信息');
    expect(combined).not.toContain('基础训练原则');
    expect(combined).not.toContain('不复制视频全文');
  });

  it('returns undefined for unknown exercise ids', () => {
    expect(getExerciseById('missing')).toBeUndefined();
  });
});
