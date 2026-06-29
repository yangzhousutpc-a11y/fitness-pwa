import { useEffect, useMemo, useRef, useState } from 'react';
import { getExerciseById } from '../data';
import { getExerciseProgress, getPersonalRecords, getWeeklyStats, type ExerciseProgressPoint } from '../analytics';
import { buildWeeklyReviewLines } from '../review';
import type { CoachPlan, WorkoutSession } from '../types';
import { buildCalendarDays, findDayName, formatDate, formatDateForAria, formatDateForDetail, formatDateShort, formatMonthTitle, formatSetLabel, formatVolume, getCalendarSessionLabel, getDateKey, getNextWorkoutSuggestion, groupSessionsByDate, summarizeCalendarSession, summarizeSession } from '../utils';
import { MetricCard } from './MetricCard';

export function History({
  sessions,
  customPlans,
  onDeleteSession,
  onReuseSession,
}: {
  sessions: WorkoutSession[];
  customPlans: CoachPlan[];
  onDeleteSession: (sessionId: string) => void;
  onReuseSession: (session: WorkoutSession) => void;
}) {
  const personalRecords = useMemo(() => getPersonalRecords(sessions), [sessions]);
  const weekly = useMemo(() => getWeeklyStats(sessions), [sessions]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => sessions[0]?.date ? getDateKey(sessions[0].date) : getDateKey(new Date()));
  const [confirmingSessionId, setConfirmingSessionId] = useState<string | null>(null);
  const confirmDeleteTimer = useRef<number | null>(null);

  const trackedExerciseId = selectedExerciseId || personalRecords[0]?.exerciseId || '';
  const progress = useMemo(
    () => (trackedExerciseId ? getExerciseProgress(sessions, trackedExerciseId) : []),
    [sessions, trackedExerciseId],
  );

  useEffect(() => () => {
    if (confirmDeleteTimer.current) {
      window.clearTimeout(confirmDeleteTimer.current);
    }
  }, []);

  function askDeleteSession(sessionId: string) {
    setConfirmingSessionId(sessionId);
    if (confirmDeleteTimer.current) {
      window.clearTimeout(confirmDeleteTimer.current);
    }
    confirmDeleteTimer.current = window.setTimeout(() => {
      setConfirmingSessionId(null);
      confirmDeleteTimer.current = null;
    }, 3000);
  }

  function confirmDeleteSession(sessionId: string) {
    if (confirmDeleteTimer.current) {
      window.clearTimeout(confirmDeleteTimer.current);
      confirmDeleteTimer.current = null;
    }
    setConfirmingSessionId(null);
    onDeleteSession(sessionId);
  }

  if (sessions.length === 0) {
    return (
      <section className="screen with-nav">
        <TrainingCalendar
          sessions={sessions}
          customPlans={customPlans}
          selectedDateKey={selectedCalendarDate}
          onSelectDate={setSelectedCalendarDate}
          onReuseSession={onReuseSession}
        />
        <div className="empty-state">还没有训练记录。进入计划并完成一次训练后会自动保存。</div>
      </section>
    );
  }

  return (
    <section className="screen with-nav">
      <WeeklyRecapCard weekly={weekly} latestSession={sessions[0]} customPlans={customPlans} />

      <TrainingCalendar
        sessions={sessions}
        customPlans={customPlans}
        selectedDateKey={selectedCalendarDate}
        onSelectDate={setSelectedCalendarDate}
        onReuseSession={onReuseSession}
      />

      {personalRecords.length > 0 ? (
        <section className="section-block">
          <div className="section-title">
            <h2>动作进度</h2>
            <select
              className="exercise-picker"
              value={trackedExerciseId}
              onChange={(event) => setSelectedExerciseId(event.target.value)}
              aria-label="选择要查看进度的动作"
            >
              {personalRecords.map((pr) => (
                <option key={pr.exerciseId} value={pr.exerciseId}>
                  {getExerciseById(pr.exerciseId)?.name ?? pr.exerciseId}
                </option>
              ))}
            </select>
          </div>
          <ProgressChart points={progress} />
        </section>
      ) : null}

      {personalRecords.length > 0 ? (
        <section className="section-block">
          <div className="section-title">
            <h2>个人最好成绩</h2>
            <span>{personalRecords.length} 个动作</span>
          </div>
          <div className="pr-list">
            {personalRecords.map((pr) => (
              <article className="pr-card" key={pr.exerciseId}>
                <div>
                  <strong>{getExerciseById(pr.exerciseId)?.name ?? pr.exerciseId}</strong>
                  <span>{pr.sessionCount} 次 · {formatDateShort(pr.bestWeightDate)}</span>
                </div>
                <div className="pr-value">
                  <em>{pr.bestWeight}</em>
                  <small>kg</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="section-block">
        <div className="section-title">
          <h2>训练记录</h2>
          <span>{sessions.length} 次</span>
        </div>
        <div className="history-list">
          {sessions.map((session) => {
            const sessionName = findDayName(session, customPlans);
            const isConfirmingDelete = confirmingSessionId === session.id;
            return (
              <article className="history-card" key={session.id}>
                <div className="history-card-header">
                  <div className="history-card-copy">
                    <strong>{sessionName}</strong>
                    <span>{formatDate(session.date)}</span>
                  </div>
                  <div className="history-card-actions">
                    <button
                      className="secondary-button history-reuse"
                      type="button"
                      onClick={() => onReuseSession(session)}
                      aria-label={`复用${sessionName}到今天`}
                    >
                      复用
                    </button>
                    <button
                      className={isConfirmingDelete ? 'danger-button history-delete confirming' : 'danger-button history-delete'}
                      type="button"
                      onClick={() => (isConfirmingDelete ? confirmDeleteSession(session.id) : askDeleteSession(session.id))}
                      aria-label={`${isConfirmingDelete ? '确认删除' : '删除'}${sessionName}训练记录`}
                    >
                      {isConfirmingDelete ? '确认删除？' : '删除'}
                    </button>
                  </div>
                </div>
                <p>{summarizeSession(session)}</p>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}

function WeeklyRecapCard({
  weekly,
  latestSession,
  customPlans,
}: {
  weekly: ReturnType<typeof getWeeklyStats>;
  latestSession: WorkoutSession | undefined;
  customPlans: CoachPlan[];
}) {
  const latestSessionName = latestSession ? findDayName(latestSession, customPlans) : null;
  const reviewLines = buildWeeklyReviewLines(weekly, latestSessionName);
  const volumeDelta = weekly.previousVolume > 0
    ? Math.round(((weekly.recentVolume - weekly.previousVolume) / weekly.previousVolume) * 100)
    : null;

  return (
    <section className="section-block weekly-recap-card" aria-label="本周训练复盘">
      <div className="section-title">
        <h2>本周复盘</h2>
        <span>近 7 天</span>
      </div>
      <div className="weekly-recap-main">
        <div>
          <strong>{weekly.recentSessions}</strong>
          <span>次训练</span>
          <p>最近一次：{latestSessionName ?? '暂无记录'}</p>
        </div>
        <div className="weekly-recap-volume">
          <strong>{formatVolume(weekly.recentVolume)}</strong>
          <span>总容量</span>
        </div>
      </div>
      <div className="weekly-recap-metrics">
        <MetricCard label="完成组" value={`${weekly.recentCompletedSets}`} />
        <MetricCard label="训练次数变化" value={`${weekly.recentSessions - weekly.previousSessions >= 0 ? '+' : ''}${weekly.recentSessions - weekly.previousSessions}`} />
        <MetricCard label="较上周容量" value={volumeDelta === null ? '新记录' : `${volumeDelta >= 0 ? '+' : ''}${volumeDelta}%`} />
      </div>
      <ul className="weekly-review-lines" aria-label="本周训练结论">
        {reviewLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

function TrainingCalendar({
  sessions,
  customPlans,
  selectedDateKey,
  onSelectDate,
  onReuseSession,
}: {
  sessions: WorkoutSession[];
  customPlans: CoachPlan[];
  selectedDateKey: string;
  onSelectDate: (dateKey: string) => void;
  onReuseSession: (session: WorkoutSession) => void;
}) {
  const monthDate = new Date();
  const sessionsByDate = useMemo(() => groupSessionsByDate(sessions), [sessions]);
  const calendarDays = useMemo(() => buildCalendarDays(monthDate, sessionsByDate), [monthDate, sessionsByDate]);
  const selectedSessions = sessionsByDate.get(selectedDateKey) ?? [];
  const nextSuggestion = getNextWorkoutSuggestion(sessions, customPlans);

  return (
    <section className="section-block">
      <div className="section-title">
        <h2>训练日历</h2>
        <span>{formatMonthTitle(monthDate)}</span>
      </div>

      {nextSuggestion ? <div className="calendar-suggestion">{nextSuggestion}</div> : null}

      <div className="training-calendar" aria-label="训练日历">
        {['一', '二', '三', '四', '五', '六', '日'].map((weekday) => (
          <span className="calendar-weekday" key={weekday}>
            {weekday}
          </span>
        ))}
        {calendarDays.map((day) => {
          const firstSession = day.sessions[0];
          const label = firstSession ? getCalendarSessionLabel(firstSession, customPlans) : '';
          return (
            <button
              type="button"
              key={day.dateKey}
              className={[
                'calendar-day',
                day.inCurrentMonth ? '' : 'muted',
                day.sessions.length > 0 ? 'trained' : '',
                day.dateKey === selectedDateKey ? 'selected' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onSelectDate(day.dateKey)}
              aria-label={`${formatDateForAria(day.date)} ${day.sessions.length > 0 ? `有训练 ${label}` : '无训练'}`}
            >
              <span>{day.date.getDate()}</span>
              {label ? <small>{label}</small> : null}
            </button>
          );
        })}
      </div>

      <div className="calendar-detail" role="region" aria-label="所选日期训练摘要">
        <strong>{formatDateForDetail(selectedDateKey)}</strong>
        {selectedSessions.length === 0 ? (
          <p>当天没有训练记录</p>
        ) : (
          <div className="calendar-session-list">
            {selectedSessions.map((session) => {
              const sessionName = findDayName(session, customPlans);
              return (
                <article className="calendar-session-card" key={session.id}>
                  <strong>训练：{sessionName}</strong>
                  <span>{summarizeCalendarSession(session)}</span>
                  <button
                    type="button"
                    className="secondary-button calendar-reuse"
                    onClick={() => onReuseSession(session)}
                    aria-label={`复用${sessionName}到今天`}
                  >
                    复用到今天
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}


function ProgressChart({ points }: { points: ExerciseProgressPoint[] }) {
  if (points.length === 0) {
    return <div className="empty-state">这个动作还没有带重量的记录。</div>;
  }

  if (points.length === 1) {
    const only = points[0];
    return (
      <div className="single-point-hint">
        仅 1 次记录：最大重量 <strong>{only.maxWeight} kg</strong>，容量 <strong>{Math.round(only.totalVolume)} kg</strong>。再练一次即可看到曲线。
      </div>
    );
  }

  const width = 320;
  const height = 160;
  const padding = { top: 16, right: 12, bottom: 24, left: 36 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const weights = points.map((p) => p.maxWeight);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const span = maxWeight - minWeight || 1;

  const stepX = points.length > 1 ? innerWidth / (points.length - 1) : 0;
  const coords = points.map((point, index) => {
    const x = padding.left + stepX * index;
    const ratio = (point.maxWeight - minWeight) / span;
    const y = padding.top + innerHeight - ratio * innerHeight;
    return { x, y, point };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPath =
    `M${coords[0].x.toFixed(1)},${(padding.top + innerHeight).toFixed(1)} ` +
    coords.map((c) => `L${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ') +
    ` L${coords[coords.length - 1].x.toFixed(1)},${(padding.top + innerHeight).toFixed(1)} Z`;

  return (
    <div className="progress-chart" role="img" aria-label="最大重量随时间变化曲线">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + innerHeight}
          className="chart-axis"
        />
        <line
          x1={padding.left}
          y1={padding.top + innerHeight}
          x2={padding.left + innerWidth}
          y2={padding.top + innerHeight}
          className="chart-axis"
        />
        <text x={padding.left - 6} y={padding.top + 4} className="chart-tick" textAnchor="end">
          {maxWeight}
        </text>
        <text x={padding.left - 6} y={padding.top + innerHeight} className="chart-tick" textAnchor="end">
          {minWeight}
        </text>
        <path d={areaPath} className="chart-area" />
        <path d={linePath} className="chart-line" />
        {coords.map((c) => (
          <circle key={c.point.sessionId} cx={c.x} cy={c.y} r={3.5} className="chart-dot" />
        ))}
      </svg>
      <div className="chart-footer">
        <span>{formatDateShort(points[0].date)}</span>
        <span>最大重量 (kg)</span>
        <span>{formatDateShort(points[points.length - 1].date)}</span>
      </div>
    </div>
  );
}
