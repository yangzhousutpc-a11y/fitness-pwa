import { describe, expect, it } from 'vitest';
import { buildWeeklyReviewLines } from './review';

describe('weekly review copy', () => {
  it('turns weekly stats into actionable review lines', () => {
    expect(
      buildWeeklyReviewLines(
        {
          recentSessions: 2,
          recentCompletedSets: 20,
          recentVolume: 3600,
          previousSessions: 1,
          previousCompletedSets: 10,
          previousVolume: 3000,
        },
        'Day 1 胸 / 肩 / 三头',
      ),
    ).toEqual([
      '本周训练频率比上个周期多 1 次，先保持节奏。',
      '本周总容量增加 600kg，下次保持动作质量再小幅推进。',
      '最近一次完成 Day 1 胸 / 肩 / 三头，下次按当前计划顺序继续。',
    ]);
  });

  it('explains the empty state without system-like instructions', () => {
    expect(
      buildWeeklyReviewLines(
        {
          recentSessions: 0,
          recentCompletedSets: 0,
          recentVolume: 0,
          previousSessions: 0,
          previousCompletedSets: 0,
          previousVolume: 0,
        },
        null,
      ),
    ).toEqual([
      '本周还没有完成训练，先把今天的一次训练记录下来。',
      '还没有形成有效容量，完成组需要填写重量和次数才会进入复盘。',
      '还没有最近训练记录，先从当前跟练计划的第一天开始。',
    ]);
  });
});
