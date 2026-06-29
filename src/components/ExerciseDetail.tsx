import { useMemo } from 'react';
import { getExerciseById } from '../data';
import { getExerciseHistory, getExercisePerformanceSummary } from '../analytics';
import type { WorkoutSession } from '../types';
import { formatDateShort, formatSetLabel, formatVolume, formatWeight, getCoachNoteForExercise, getExerciseImageUrl, getExerciseProfileGoal, withBase } from '../utils';
import { MetricCard } from './MetricCard';

export function ExerciseDetail({ exerciseId, sessions }: { exerciseId: string; sessions: WorkoutSession[] }) {
  const exercise = getExerciseById(exerciseId);
  const coachNote = getCoachNoteForExercise(exerciseId);
  const imageUrl = getExerciseImageUrl(exerciseId);
  const resolvedImageUrl = imageUrl ? withBase(imageUrl) : '';
  const profileGoal = exercise ? getExerciseProfileGoal(exercise, coachNote) : '';
  const history = useMemo(() => getExerciseHistory(sessions, exerciseId), [sessions, exerciseId]);
  const summary = useMemo(() => getExercisePerformanceSummary(sessions, exerciseId), [sessions, exerciseId]);
  const recentHistory = history.slice(0, 5);
  const maxRecentVolume = Math.max(...recentHistory.map((item) => item.totalVolume), 1);

  if (!exercise) {
    return (
      <section className="screen with-nav">
        <div className="empty-state">没有找到这个动作。</div>
      </section>
    );
  }

  return (
    <section className="screen with-nav exercise-detail-screen">
      <section className="exercise-detail-hero">
        <div className="exercise-detail-image-frame">
          {resolvedImageUrl ? (
            <img src={resolvedImageUrl} alt={`${exercise.name}动作插图`} />
          ) : (
            <span>暂无动作示意图</span>
          )}
        </div>
        <div className="exercise-detail-copy">
          <span>动作档案</span>
          <h2>{profileGoal}</h2>
          <p>{exercise.muscleGroups.join(' / ')} · {exercise.equipment}</p>
        </div>
      </section>

      <section className="section-block exercise-pr-panel">
        <div className="section-title">
          <h2>我的表现</h2>
        </div>
        {summary ? (
          <div className="exercise-pr-grid">
            <MetricCard label="最大重量" value={formatWeight(summary.bestWeight)} />
            <MetricCard label="最大次数" value={`${summary.bestReps}次`} />
            <MetricCard label="单次最大容量" value={formatVolume(summary.bestVolume)} />
            <MetricCard label="估算 1RM" value={formatWeight(summary.bestEstimatedOneRepMax)} />
          </div>
        ) : (
          <div className="empty-state">暂无记录</div>
        )}
      </section>

      <section className="section-block">
        <div className="section-title">
          <h2>最近 5 次</h2>
        </div>
        {recentHistory.length > 0 ? (
          <div className="exercise-trend-list">
            {recentHistory.map((item) => (
              <article className="exercise-trend-row" key={item.sessionId}>
                <span>{formatDateShort(item.date)}</span>
                <div>
                  <strong>{formatSetLabel(item.bestSet.weight, item.bestSet.reps)} · {item.completedSets}组</strong>
                  <i style={{ width: `${Math.max(12, Math.round((item.totalVolume / maxRecentVolume) * 100))}%` }} />
                </div>
                <em>{formatVolume(item.totalVolume)}</em>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">暂无记录</div>
        )}
      </section>

      <section className="section-block exercise-tips-panel">
        <div className="section-title">
          <h2>训练提示</h2>
        </div>
        <div className="exercise-tip-list">
          <div className="exercise-tip-card">
            <h3>发力重点</h3>
            <ul>
              {(coachNote?.keyCues ?? exercise.cues).map((cue) => (
                <li key={cue}>{cue}</li>
              ))}
            </ul>
          </div>
          <div className="exercise-tip-card">
            <h3>常见错误</h3>
            <ul>
              {(coachNote?.commonMistakes ?? exercise.commonMistakes).map((mistake) => (
                <li key={mistake}>{mistake}</li>
              ))}
            </ul>
          </div>
          {coachNote?.regression ? (
            <div className="exercise-tip-card">
              <h3>退阶方式</h3>
              <p>{coachNote.regression}</p>
            </div>
          ) : null}
        </div>
      </section>
    </section>
  );
}
