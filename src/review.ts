import type { WeeklyStat } from './analytics';

export function buildWeeklyReviewLines(weekly: WeeklyStat, latestSessionName: string | null): string[] {
  const sessionDelta = weekly.recentSessions - weekly.previousSessions;
  const volumeDelta = weekly.recentVolume - weekly.previousVolume;

  const frequencyLine = weekly.recentSessions === 0
    ? '本周还没有完成训练，先把今天的一次训练记录下来。'
    : sessionDelta > 0
      ? `本周训练频率比上个周期多 ${sessionDelta} 次，先保持节奏。`
      : sessionDelta < 0
        ? `本周训练频率比上个周期少 ${Math.abs(sessionDelta)} 次，优先补回一次完整训练。`
        : '本周训练频率和上个周期持平，继续稳定推进。';

  const volumeLine = weekly.recentVolume === 0
    ? '还没有形成有效容量，完成组需要填写重量和次数才会进入复盘。'
    : weekly.previousVolume > 0
      ? volumeDelta >= 0
        ? `本周总容量增加 ${Math.round(volumeDelta)}kg，下次保持动作质量再小幅推进。`
        : `本周总容量减少 ${Math.round(Math.abs(volumeDelta))}kg，下次先恢复到上个周期的训练量。`
      : '本周已经形成新的容量基线，下次训练会更容易比较进步。';

  const nextLine = latestSessionName
    ? `最近一次完成 ${latestSessionName}，下次按当前计划顺序继续。`
    : '还没有最近训练记录，先从当前跟练计划的第一天开始。';

  return [frequencyLine, volumeLine, nextLine];
}
