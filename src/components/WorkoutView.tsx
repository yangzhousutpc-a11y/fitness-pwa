import { useEffect, useMemo, useRef, useState } from 'react';
import { CoachCueCard } from './CoachCueCard';
import { filterExercises, getExerciseById } from '../data';
import { getLastExerciseSets } from '../analytics';
import { createExerciseLog } from '../storage';
import type { CoachPlan, SetLog, WorkoutSession } from '../types';
import { findCoachNote, parseOptionalNumber } from '../utils';

type ExerciseFilter = '全部' | '胸' | '背' | '肩' | '腿' | '手臂';
type SetTarget = { exerciseId: string; setNumber: number };

export function WorkoutView({
  plan,
  session,
  sessions,
  onChange,
  onFinish,
  onInputFocusChange,
}: {
  plan: CoachPlan;
  session: WorkoutSession;
  sessions: WorkoutSession[];
  onChange: (session: WorkoutSession) => void;
  onFinish: () => void;
  onInputFocusChange: (focused: boolean) => void;
}) {
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [addFilter, setAddFilter] = useState<ExerciseFilter>('全部');
  const [activeSetTarget, setActiveSetTarget] = useState<SetTarget | null>(null);
  const [restSeconds, setRestSeconds] = useState<number | null>(null);
  // 训练页动作卡片各自独立展开/折叠；进入时默认只展开第一个动作。
  const [expandedExerciseIds, setExpandedExerciseIds] = useState<Set<string>>(
    () => new Set(session.exerciseLogs[0] ? [session.exerciseLogs[0].exerciseId] : []),
  );

  function toggleExercise(exerciseId: string) {
    setExpandedExerciseIds((current) => {
      const next = new Set(current);
      if (next.has(exerciseId)) {
        next.delete(exerciseId);
      } else {
        next.add(exerciseId);
      }
      return next;
    });
  }
  const lastSetsByExercise = useMemo(() => {
    const map: Record<string, ReturnType<typeof getLastExerciseSets>> = {};
    for (const log of session.exerciseLogs) {
      map[log.exerciseId] = getLastExerciseSets(sessions, log.exerciseId);
    }
    return map;
    // 仅在进入训练时计算一次：动作集合稳定，历史不会在训练中变化。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const day = plan.days.find((item) => item.id === session.dayId);
  const completedSets = session.exerciseLogs.flatMap((log) => log.sets).filter((set) => set.completed).length;
  const totalSets = session.exerciseLogs.flatMap((log) => log.sets).length;
  const addResults = useMemo(() => filterExercises(addQuery, addFilter), [addFilter, addQuery]);
  const existingExerciseIds = new Set(session.exerciseLogs.map((log) => log.exerciseId));
  const activeSetLabel = activeSetTarget
    ? `${getExerciseById(activeSetTarget.exerciseId)?.name ?? activeSetTarget.exerciseId} · 第 ${activeSetTarget.setNumber} 组`
    : undefined;

  function findNextSetTarget(exerciseIndex: number, setIndex: number): SetTarget | null {
    const currentLog = session.exerciseLogs[exerciseIndex];
    const nextSameExerciseSet = currentLog?.sets.slice(setIndex + 1).find((set) => !set.completed);
    if (currentLog && nextSameExerciseSet) {
      return { exerciseId: currentLog.exerciseId, setNumber: nextSameExerciseSet.setNumber };
    }

    for (const log of session.exerciseLogs.slice(exerciseIndex + 1)) {
      const nextSet = log.sets.find((set) => !set.completed);
      if (nextSet) {
        return { exerciseId: log.exerciseId, setNumber: nextSet.setNumber };
      }
    }

    return null;
  }

  useEffect(() => {
    if (!activeSetTarget) {
      return;
    }

    const timer = window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(
        `[data-exercise-id="${activeSetTarget.exerciseId}"][data-set-number="${activeSetTarget.setNumber}"]`,
      );
      if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activeSetTarget]);

  function updateSet(exerciseIndex: number, setIndex: number, patch: Partial<SetLog>) {
    const currentLog = session.exerciseLogs[exerciseIndex];
    const previousSet = currentLog?.sets[setIndex];
    const justCompleted = patch.completed === true && previousSet && !previousSet.completed;
    const nextTarget = justCompleted ? findNextSetTarget(exerciseIndex, setIndex) : null;

    const nextLogs = session.exerciseLogs.map((log, currentExerciseIndex) => {
      if (currentExerciseIndex !== exerciseIndex) {
        return log;
      }

      const completedSet = { ...log.sets[setIndex], ...patch };

      return {
        ...log,
        sets: log.sets.map((set, currentSetIndex) => {
          if (currentSetIndex === setIndex) {
            return completedSet;
          }
          // 勾完本组后，把本组重量/次数带入「下一组」——仅当下一组对应字段还空着，
          // 不覆盖用户已填的值（遵守「不擅自改已填数据」约定）。
          if (justCompleted && currentSetIndex === setIndex + 1) {
            return {
              ...set,
              weight: set.weight ?? completedSet.weight,
              reps: set.reps ?? completedSet.reps,
            };
          }
          return set;
        }),
      };
    });

    // 从「未完成」切到「完成」时启动组间休息计时。
    if (justCompleted) {
      setRestSeconds(90);
      setActiveSetTarget(nextTarget);
      if (nextTarget) {
        setExpandedExerciseIds((current) => new Set(current).add(nextTarget.exerciseId));
      }
    }

    onChange({ ...session, exerciseLogs: nextLogs });
  }

  function addSet(exerciseIndex: number) {
    const nextLogs = session.exerciseLogs.map((log, currentExerciseIndex) => {
      if (currentExerciseIndex !== exerciseIndex) {
        return log;
      }

      return {
        ...log,
        sets: [
          ...log.sets,
          {
            setNumber: log.sets.length + 1,
            weight: null,
            reps: null,
            completed: false,
          },
        ],
      };
    });

    onChange({ ...session, exerciseLogs: nextLogs });
  }

  function removeLastSet(exerciseIndex: number) {
    const nextLogs = session.exerciseLogs.map((log, currentExerciseIndex) => {
      if (currentExerciseIndex !== exerciseIndex || log.sets.length <= 1) {
        return log;
      }

      return {
        ...log,
        sets: log.sets.slice(0, -1),
      };
    });

    onChange({ ...session, exerciseLogs: nextLogs });
  }

  function updateNote(exerciseIndex: number, note: string) {
    const nextLogs = session.exerciseLogs.map((log, currentExerciseIndex) =>
      currentExerciseIndex === exerciseIndex ? { ...log, note } : log,
    );
    onChange({ ...session, exerciseLogs: nextLogs });
  }

  function addExercise(exerciseId: string) {
    if (existingExerciseIds.has(exerciseId)) {
      return;
    }

    onChange({ ...session, exerciseLogs: [...session.exerciseLogs, createExerciseLog(exerciseId)] });
    setAddQuery('');
    setAddFilter('全部');
    setIsAddingExercise(false);
  }

  function focusSetInput(target: HTMLInputElement, nextTarget: SetTarget) {
    setActiveSetTarget(nextTarget);
    onInputFocusChange(true);
    window.requestAnimationFrame(() => {
      const stepper = target.closest('.stepper');
      if (stepper instanceof HTMLElement && typeof stepper.scrollIntoView === 'function') {
        stepper.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
    });
  }

  return (
    <section className="screen workout-screen">
      <div className="workout-summary">
        <div>
          <p className="eyebrow">{day?.name}</p>
          <h2>
            {completedSets}/{totalSets} 组完成
          </h2>
        </div>
        <button type="button" className="finish-button" onClick={onFinish}>
          完成
        </button>
      </div>

      {restSeconds !== null ? (
        <RestTimer initialSeconds={restSeconds} nextSetLabel={activeSetLabel} onClose={() => setRestSeconds(null)} />
      ) : null}

      <div className="workout-tools" aria-label="训练辅助操作">
        <button type="button" className="ghost-button compact" onClick={() => setIsAddingExercise(!isAddingExercise)}>
          {isAddingExercise ? '收起添加' : '添加动作'}
        </button>
      </div>

      {isAddingExercise ? (
        <section className="workout-add-panel" aria-label="从动作库添加动作">
          <input
            value={addQuery}
            onChange={(event) => setAddQuery(event.target.value)}
            placeholder="搜索要加入的动作"
          />
          <div className="filter-pills compact" aria-label="添加动作肌群筛选">
            {(['全部', '胸', '背', '肩', '腿', '手臂'] as ExerciseFilter[]).map((filterOption) => (
              <button
                key={filterOption}
                type="button"
                className={filterOption === addFilter ? 'active' : ''}
                onClick={() => setAddFilter(filterOption)}
              >
                {filterOption}
              </button>
            ))}
          </div>
          <div className="exercise-add-list">
            {addResults.slice(0, 12).map((exercise) => {
              const isAdded = existingExerciseIds.has(exercise.id);
              return (
                <article className="exercise-add-card" key={exercise.id}>
                  <div>
                    <strong>{exercise.name}</strong>
                    <span>{exercise.muscleGroups.join(' / ')} · {exercise.equipment}</span>
                  </div>
                  <button
                    type="button"
                    disabled={isAdded}
                    onClick={() => addExercise(exercise.id)}
                    aria-label={isAdded ? `${exercise.name}本次训练已包含` : `将${exercise.name}加入训练`}
                  >
                    {isAdded ? '本计划已含' : '加入'}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {session.exerciseLogs.map((log, exerciseIndex) => {
        const exercise = getExerciseById(log.exerciseId);
        const coachNote = day ? findCoachNote(day, log.exerciseId) : undefined;
        const exerciseName = exercise?.name ?? log.exerciseId;
        const isExpanded = expandedExerciseIds.has(log.exerciseId);
        const doneCount = log.sets.filter((set) => set.completed).length;

        return (
          <article className={isExpanded ? 'exercise-log-card active' : 'exercise-log-card'} key={log.exerciseId}>
            <button
              type="button"
              className="exercise-heading"
              onClick={() => toggleExercise(log.exerciseId)}
              aria-expanded={isExpanded}
              aria-label={`${exerciseName} 展开收起`}
            >
              <div>
                <h3>{exerciseName}</h3>
                <p>{exercise?.muscleGroups.join(' / ')} · {exercise?.equipment}</p>
              </div>
              <span className="exercise-heading-meta">
                <span>{doneCount}/{log.sets.length}</span>
                <span className="exercise-chevron" aria-hidden="true">{isExpanded ? '▴' : '▾'}</span>
              </span>
            </button>

            {isExpanded ? (
              <div className="exercise-log-body">
                <div className="set-grid">
                  <div className="set-grid-header">
                    <span>组</span>
                    <span>重量</span>
                    <span>次数</span>
                    <span>完成</span>
                  </div>
                  {log.sets.map((set, setIndex) => (
                    <SetRow
                      key={set.setNumber}
                      exerciseId={log.exerciseId}
                      isActive={
                        activeSetTarget?.exerciseId === log.exerciseId && activeSetTarget.setNumber === set.setNumber
                      }
                      set={set}
                      lastSet={lastSetsByExercise[log.exerciseId]?.[setIndex]}
                      onChange={(patch) => updateSet(exerciseIndex, setIndex, patch)}
                      onInputFocus={(target) => focusSetInput(target, { exerciseId: log.exerciseId, setNumber: set.setNumber })}
                      onInputBlur={() => onInputFocusChange(false)}
                    />
                  ))}
                </div>

                <div className="set-actions">
                  <button type="button" onClick={() => addSet(exerciseIndex)} aria-label={`给${exerciseName}增加一组`}>
                    + 组
                  </button>
                  <button
                    type="button"
                    onClick={() => removeLastSet(exerciseIndex)}
                    disabled={log.sets.length <= 1}
                    aria-label={`删除${exerciseName}最后一组`}
                  >
                    - 组
                  </button>
                </div>

                {coachNote ? <CoachCueCard note={coachNote} defaultOpen={false} /> : null}

                <textarea
                  value={log.note}
                  onChange={(event) => updateNote(exerciseIndex, event.target.value)}
                  placeholder="备注"
                  rows={2}
                />
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}

// 休息结束的轻提示音（Web Audio 合成，无需音频文件）。两声短促上行蜂鸣。
function playBeep() {
  try {
    const AudioCtx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      return;
    }
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [0, 0.18].forEach((offset, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = index === 0 ? 660 : 880;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.16);
    });
    window.setTimeout(() => ctx.close(), 600);
  } catch {
    // 静默失败：部分浏览器需用户手势激活音频，不影响其他功能。
  }
}

function RestTimer({
  initialSeconds,
  nextSetLabel,
  onClose,
}: {
  initialSeconds: number;
  nextSetLabel?: string;
  onClose: () => void;
}) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [running, setRunning] = useState(true);
  const deadlineRef = useRef(Date.now() + initialSeconds * 1000);
  const pausedSecondsRef = useRef(initialSeconds);
  const doneRef = useRef(false);

  function getRemainingSeconds() {
    return Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
  }

  function syncRemainingSeconds() {
    setSeconds(getRemainingSeconds());
  }

  useEffect(() => {
    if (!running) {
      return;
    }

    syncRemainingSeconds();
    const timer = window.setInterval(syncRemainingSeconds, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    function syncAfterBackground() {
      if (running) {
        syncRemainingSeconds();
      }
    }

    document.addEventListener('visibilitychange', syncAfterBackground);
    window.addEventListener('focus', syncAfterBackground);
    window.addEventListener('pageshow', syncAfterBackground);

    return () => {
      document.removeEventListener('visibilitychange', syncAfterBackground);
      window.removeEventListener('focus', syncAfterBackground);
      window.removeEventListener('pageshow', syncAfterBackground);
    };
  }, [running]);

  useEffect(() => {
    if (seconds === 0 && !doneRef.current) {
      doneRef.current = true;
      setRunning(false);
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(200);
      }
      playBeep();
      onClose();
    }
  }, [onClose, seconds]);

  function adjust(delta: number) {
    const currentSeconds = running ? getRemainingSeconds() : seconds;
    const nextSeconds = Math.max(0, currentSeconds + delta);
    doneRef.current = false;
    pausedSecondsRef.current = nextSeconds;
    deadlineRef.current = Date.now() + nextSeconds * 1000;
    setSeconds(nextSeconds);
    setRunning(nextSeconds > 0);
  }

  function toggleRunning() {
    if (running) {
      const remaining = getRemainingSeconds();
      pausedSecondsRef.current = remaining;
      setSeconds(remaining);
      setRunning(false);
      return;
    }

    doneRef.current = false;
    deadlineRef.current = Date.now() + pausedSecondsRef.current * 1000;
    setRunning(true);
  }

  const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
  const ss = (seconds % 60).toString().padStart(2, '0');

  return (
    <div className={seconds === 0 ? 'rest-timer done' : 'rest-timer'} role="timer" aria-label="组间休息计时器">
      <div className="rest-timer-display">
        <span className="rest-timer-time">{mm}:{ss}</span>
        <span className="rest-timer-hint">
          {seconds === 0 ? `继续${nextSetLabel ? ` ${nextSetLabel}` : ''}` : nextSetLabel ? `休息后录 ${nextSetLabel}` : '组间休息'}
        </span>
      </div>
      <div className="rest-timer-controls">
        <button type="button" onClick={() => adjust(-15)} aria-label="减少 15 秒">-15s</button>
        <button type="button" onClick={toggleRunning} aria-label={running ? '暂停休息' : '继续休息'}>
          {running ? '暂停' : '继续'}
        </button>
        <button type="button" onClick={() => adjust(15)} aria-label="增加 15 秒">+15s</button>
        <button type="button" className="rest-timer-close" onClick={onClose} aria-label="关闭休息计时器">
          跳过
        </button>
      </div>
    </div>
  );
}

function SetRow({
  exerciseId,
  isActive,
  set,
  lastSet,
  onChange,
  onInputFocus,
  onInputBlur,
}: {
  exerciseId: string;
  isActive: boolean;
  set: SetLog;
  lastSet?: { weight: number | null; reps: number | null };
  onChange: (patch: Partial<SetLog>) => void;
  onInputFocus?: (target: HTMLInputElement) => void;
  onInputBlur?: () => void;
}) {
  // 窄输入框里占位文字要短：有历史就直接显示上次数值作参考，否则用单位提示。
  const weightHint = lastSet?.weight != null ? `${lastSet.weight}` : 'kg';
  const repsHint = lastSet?.reps != null ? `${lastSet.reps}` : '次';

  function stepWeight(delta: number) {
    const base = set.weight ?? lastSet?.weight ?? 0;
    onChange({ weight: Math.max(0, Math.round((base + delta) * 100) / 100) });
  }

  function stepReps(delta: number) {
    const base = set.reps ?? lastSet?.reps ?? 0;
    onChange({ reps: Math.max(0, base + delta) });
  }

  return (
    <div
      className={set.completed ? 'set-row completed' : isActive ? 'set-row active' : 'set-row'}
      data-exercise-id={exerciseId}
      data-set-number={set.setNumber}
    >
      <strong>{set.setNumber}</strong>
      <div className="stepper">
        <button type="button" onClick={() => stepWeight(-5)} aria-label={`第 ${set.setNumber} 组重量减 5`}>−</button>
        <input
          inputMode="decimal"
          aria-label={`第 ${set.setNumber} 组重量`}
          value={set.weight ?? ''}
          placeholder={weightHint}
          onChange={(event) => onChange({ weight: parseOptionalNumber(event.target.value) })}
          onFocus={(event) => onInputFocus?.(event.currentTarget)}
          onBlur={onInputBlur}
        />
        <button type="button" onClick={() => stepWeight(5)} aria-label={`第 ${set.setNumber} 组重量加 5`}>＋</button>
      </div>
      <div className="stepper">
        <button type="button" onClick={() => stepReps(-1)} aria-label={`第 ${set.setNumber} 组次数减 1`}>−</button>
        <input
          inputMode="numeric"
          aria-label={`第 ${set.setNumber} 组次数`}
          value={set.reps ?? ''}
          placeholder={repsHint}
          onChange={(event) => onChange({ reps: parseOptionalNumber(event.target.value) })}
          onFocus={(event) => onInputFocus?.(event.currentTarget)}
          onBlur={onInputBlur}
        />
        <button type="button" onClick={() => stepReps(1)} aria-label={`第 ${set.setNumber} 组次数加 1`}>＋</button>
      </div>
      <button
        type="button"
        className={set.completed ? 'check-button done' : 'check-button'}
        onClick={() => onChange({ completed: !set.completed })}
        aria-label={`切换第 ${set.setNumber} 组完成状态`}
      >
        {set.completed ? '✓' : '○'}
      </button>
    </div>
  );
}
