import { useEffect, useMemo, useRef, useState } from 'react';
import { coachPlans, filterExercises, getExerciseById } from './data';
import {
  getExerciseProgress,
  getLastExerciseSets,
  getPersonalRecords,
  getWeeklyStats,
  type ExerciseProgressPoint,
} from './analytics';
import {
  createEmptyCustomPlan,
  createExerciseLog,
  createSessionFromDay,
  loadCustomPlans,
  loadSessions,
  saveCustomPlans,
  saveSession,
} from './storage';
import type { CoachExerciseNote, CoachPlan, ExerciseLog, SetLog, TrainingDayTemplate, WorkoutSession } from './types';

type Tab = 'plans' | 'exercises' | 'history';
type ExerciseFilter = '全部' | '胸' | '背' | '肩' | '腿' | '手臂';
type Route =
  | { name: 'home' }
  | { name: 'custom-library' }
  | { name: 'builtin-plan'; planId: string; expandedDayId?: string }
  | { name: 'custom-plan'; planId: string; expandedDayId?: string }
  | { name: 'workout'; planKind: 'builtin' | 'custom'; planId: string; dayId: string; session: WorkoutSession };

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('plans');
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [sessions, setSessions] = useState<WorkoutSession[]>(() => loadSessions());
  const [customPlans, setCustomPlans] = useState<CoachPlan[]>(() => loadCustomPlans());
  const [exerciseQuery, setExerciseQuery] = useState('');
  const [exerciseFilter, setExerciseFilter] = useState<ExerciseFilter>('全部');

  useEffect(() => {
    saveCustomPlans(customPlans);
  }, [customPlans]);

  const builtinPlan = route.name === 'builtin-plan' || route.name === 'workout'
    ? coachPlans.find((item) => item.id === route.planId)
    : undefined;
  const customPlan = route.name === 'custom-plan'
    ? customPlans.find((item) => item.id === route.planId)
    : route.name === 'workout' && route.planKind === 'custom'
      ? customPlans.find((item) => item.id === route.planId)
      : undefined;
  const selectedPlan = builtinPlan ?? customPlan;
  const activeDay =
    route.name === 'workout' && selectedPlan ? selectedPlan.days.find((day) => day.id === route.dayId) : undefined;
  const header = getHeaderCopy(route, activeTab, selectedPlan, activeDay);

  function openBuiltinPlan(planId: string, expandedDayId?: string) {
    setActiveTab('plans');
    setRoute({ name: 'builtin-plan', planId, expandedDayId });
  }

  function openCustomPlan(planId: string, expandedDayId?: string) {
    setActiveTab('plans');
    setRoute({ name: 'custom-plan', planId, expandedDayId });
  }

  function openCustomLibrary() {
    setActiveTab('plans');
    setRoute({ name: 'custom-library' });
  }

  function createCustomPlan() {
    const nextPlan = createEmptyCustomPlan();
    setCustomPlans((current) => [nextPlan, ...current]);
    setActiveTab('plans');
    setRoute({ name: 'custom-plan', planId: nextPlan.id, expandedDayId: nextPlan.days[0]?.id });
  }

  function deleteCustomPlan(planId: string) {
    setCustomPlans((current) => current.filter((item) => item.id !== planId));
    if (route.name === 'custom-plan' && route.planId === planId) {
      setRoute({ name: 'custom-library' });
      setActiveTab('plans');
    }
  }

  function startWorkout(currentPlan: CoachPlan, day: TrainingDayTemplate) {
    setRoute({
      name: 'workout',
      planKind: currentPlan.planType,
      planId: currentPlan.id,
      dayId: day.id,
      session: createSessionFromDay(currentPlan, day),
    });
  }

  function updateSession(nextSession: WorkoutSession) {
    if (route.name === 'workout') {
      setRoute({ ...route, session: nextSession });
    }
  }

  function finishWorkout(session: WorkoutSession) {
    saveSession(session);
    setSessions(loadSessions());
    setActiveTab('history');
    setRoute({ name: 'home' });
  }

  function updateCustomPlan(nextPlan: CoachPlan) {
    setCustomPlans((current) => [nextPlan, ...current.filter((item) => item.id !== nextPlan.id)]);
  }

  function goHome(tab: Tab = activeTab) {
    setActiveTab(tab);
    setRoute({ name: 'home' });
  }

  function goBack() {
    setActiveTab('plans');
    if (route.name === 'custom-plan') {
      setRoute({ name: 'custom-library' });
      return;
    }
    if (route.name === 'workout' && route.planKind === 'custom') {
      setRoute({ name: 'custom-library' });
      return;
    }
    setRoute({ name: 'home' });
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>{header.title}</h1>
          <p>{header.subtitle}</p>
        </div>
        {route.name !== 'home' ? (
          <button className="icon-button" type="button" onClick={() => goBack()} aria-label="返回">
            ←
          </button>
        ) : null}
      </header>

      {route.name === 'home' && activeTab === 'plans' ? (
        <PlanHome
          builtinPlan={coachPlans[0]}
          customPlanCount={customPlans.length}
          sessions={sessions}
          onOpenBuiltinPlan={openBuiltinPlan}
          onOpenCustomLibrary={openCustomLibrary}
          onOpenHistory={() => {
            setActiveTab('history');
            setRoute({ name: 'home' });
          }}
        />
      ) : null}
      {route.name === 'custom-library' ? (
        <CustomPlanLibrary
          customPlans={customPlans}
          onOpenCustomPlan={openCustomPlan}
          onCreateCustomPlan={createCustomPlan}
          onDeleteCustomPlan={deleteCustomPlan}
        />
      ) : null}
      {route.name === 'home' && activeTab === 'exercises' ? (
        <ExerciseLibrary
          query={exerciseQuery}
          filter={exerciseFilter}
          onQueryChange={setExerciseQuery}
          onFilterChange={setExerciseFilter}
        />
      ) : null}
      {route.name === 'home' && activeTab === 'history' ? <History sessions={sessions} /> : null}
      {route.name === 'builtin-plan' && selectedPlan ? (
        <PlanDetail
          plan={selectedPlan}
          editable={false}
          initialExpandedDayId={route.expandedDayId}
          onStartWorkout={startWorkout}
        />
      ) : null}
      {route.name === 'custom-plan' && selectedPlan ? (
        <PlanDetail
          plan={selectedPlan}
          editable
          initialExpandedDayId={route.expandedDayId}
          onChangePlan={updateCustomPlan}
          onStartWorkout={startWorkout}
        />
      ) : null}
      {route.name === 'workout' && selectedPlan ? (
        <WorkoutView
          plan={selectedPlan}
          session={route.session}
          onChange={updateSession}
          onFinish={() => finishWorkout(route.session)}
        />
      ) : null}

      {route.name === 'home' || route.name === 'custom-library' ? (
        <BottomNav
          activeTab={activeTab}
          onChange={(tab) => {
            setActiveTab(tab);
            setRoute({ name: 'home' });
          }}
        />
      ) : null}
    </main>
  );
}

function PlanHome({
  builtinPlan,
  customPlanCount,
  sessions,
  onOpenBuiltinPlan,
  onOpenCustomLibrary,
  onOpenHistory,
}: {
  builtinPlan: CoachPlan;
  customPlanCount: number;
  sessions: WorkoutSession[];
  onOpenBuiltinPlan: (planId: string, expandedDayId?: string) => void;
  onOpenCustomLibrary: () => void;
  onOpenHistory: () => void;
}) {
  const latestSession = sessions[0];
  const weekly = useMemo(() => getWeeklyStats(sessions), [sessions]);
  const personalRecords = useMemo(() => getPersonalRecords(sessions), [sessions]);
  // 首页只放速览：PR 取前 3，看全部去历史页。
  const topRecords = personalRecords.slice(0, 3);

  return (
    <section className="screen with-nav">
      <div className="entry-grid">
        <button
          type="button"
          className="entry-card entry-builtin"
          aria-label="进入名师计划"
          onClick={() => onOpenBuiltinPlan(builtinPlan.id)}
        >
          <span className="entry-eyebrow">名师计划</span>
          <strong className="entry-title">{builtinPlan.coachName}</strong>
          <span className="entry-desc">{builtinPlan.days.length} 天三分化 · 跟练要点</span>
          <span className="entry-cta">进入 →</span>
        </button>

        <button type="button" className="entry-card entry-custom" aria-label="进入我的计划" onClick={onOpenCustomLibrary}>
          <span className="entry-eyebrow">我的计划</span>
          <strong className="entry-title">自定义训练库</strong>
          <span className="entry-desc">{customPlanCount > 0 ? `${customPlanCount} 个计划` : '从动作库自由搭建'}</span>
          <span className="entry-cta">进入 →</span>
        </button>
      </div>

      {sessions.length > 0 ? (
        <section className="section-block">
          <div className="section-title">
            <h2>本周概览</h2>
            <span>近 7 天</span>
          </div>
          <div className="stat-grid">
            <StatTile label="训练次数" value={weekly.recentSessions} delta={weekly.recentSessions - weekly.previousSessions} />
            <StatTile label="完成组数" value={weekly.recentCompletedSets} delta={weekly.recentCompletedSets - weekly.previousCompletedSets} />
            <StatTile label="总容量 (kg)" value={Math.round(weekly.recentVolume)} delta={Math.round(weekly.recentVolume - weekly.previousVolume)} />
          </div>
        </section>
      ) : null}

      {topRecords.length > 0 ? (
        <section className="section-block">
          <div className="section-title">
            <h2>个人最好成绩</h2>
            <button type="button" className="link-button" onClick={onOpenHistory}>
              全部 {personalRecords.length} 个 →
            </button>
          </div>
          <div className="pr-list">
            {topRecords.map((pr) => (
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
          <h2>最近记录</h2>
          {sessions.length > 0 ? (
            <button type="button" className="link-button" onClick={onOpenHistory}>
              查看全部 →
            </button>
          ) : null}
        </div>
        {latestSession ? (
          <div className="history-card compact">
            <strong>{findDayName(latestSession)}</strong>
            <span>{formatDate(latestSession.date)}</span>
          </div>
        ) : (
          <div className="empty-state">完成一次训练后，这里会显示最近记录。</div>
        )}
      </section>
    </section>
  );
}

function CustomPlanLibrary({
  customPlans,
  onOpenCustomPlan,
  onCreateCustomPlan,
  onDeleteCustomPlan,
}: {
  customPlans: CoachPlan[];
  onOpenCustomPlan: (planId: string, expandedDayId?: string) => void;
  onCreateCustomPlan: () => void;
  onDeleteCustomPlan: (planId: string) => void;
}) {
  return (
    <section className="screen with-nav">
      <div className="section-block">
        <button type="button" className="primary-button full-width" onClick={onCreateCustomPlan}>
          + 新建自定义计划
        </button>
      </div>

      <section className="section-block">
        <div className="section-title">
          <h2>我的计划</h2>
          <span>{customPlans.length} 个</span>
        </div>
        {customPlans.length === 0 ? (
          <div className="custom-empty">
            <div className="custom-empty-icon" aria-hidden="true">＋</div>
            <strong>还没有自定义计划</strong>
            <p>点上方「新建自定义计划」，从动作库挑动作、组成训练日，保存后即可像名师计划一样逐组记录。</p>
          </div>
        ) : (
          <div className="custom-plan-list">
            {customPlans.map((item) => {
              const exerciseIds = item.days.flatMap((day) => day.exerciseIds);
              const muscleGroups = Array.from(
                new Set(exerciseIds.flatMap((id) => getExerciseById(id)?.muscleGroups ?? [])),
              ).slice(0, 4);
              return (
                <article className="custom-plan-card" key={item.id}>
                  <div className="custom-plan-head">
                    <strong>{item.title.trim() || '未命名计划'}</strong>
                    <span>{item.days.length} 个训练日 · {exerciseIds.length} 个动作</span>
                  </div>
                  {muscleGroups.length > 0 ? (
                    <div className="custom-plan-tags">
                      {muscleGroups.map((mg) => (
                        <span className="muscle-tag" key={mg}>{mg}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="custom-plan-hint">还没有动作，点「编辑」从动作库添加。</p>
                  )}
                  <div className="custom-plan-actions">
                    <button type="button" className="secondary-button" onClick={() => onOpenCustomPlan(item.id)}>
                      编辑
                    </button>
                    <button type="button" className="primary-button" onClick={() => onOpenCustomPlan(item.id, item.days[0]?.id)}>
                      进入
                    </button>
                    <button type="button" className="danger-button" onClick={() => onDeleteCustomPlan(item.id)}>
                      删除
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}

function PlanDetail({
  plan,
  editable = false,
  initialExpandedDayId,
  onChangePlan,
  onStartWorkout,
}: {
  plan: CoachPlan;
  editable?: boolean;
  initialExpandedDayId?: string;
  onChangePlan?: (plan: CoachPlan) => void;
  onStartWorkout: (plan: CoachPlan, day: TrainingDayTemplate) => void;
}) {
  // 训练日改为各自独立展开/收起（不再互斥），手机上想对比多天无需来回点。
  const [expandedDayIds, setExpandedDayIds] = useState<Set<string>>(
    () => new Set(initialExpandedDayId ? [initialExpandedDayId] : plan.days[0] ? [plan.days[0].id] : []),
  );
  const [pickerDayId, setPickerDayId] = useState(initialExpandedDayId ?? plan.days[0]?.id);

  function toggleDay(dayId: string) {
    setExpandedDayIds((current) => {
      const next = new Set(current);
      if (next.has(dayId)) {
        next.delete(dayId);
      } else {
        next.add(dayId);
      }
      return next;
    });
  }
  const [addQuery, setAddQuery] = useState('');
  const [addFilter, setAddFilter] = useState<ExerciseFilter>('全部');
  const addResults = useMemo(() => filterExercises(addQuery, addFilter), [addFilter, addQuery]);

  function commitPlan(nextPlan: CoachPlan) {
    if (editable && onChangePlan) {
      onChangePlan(nextPlan);
    }
  }

  function updatePlanField(field: 'title' | 'description', value: string) {
    commitPlan({ ...plan, [field]: value });
  }

  function updateDayName(dayId: string, value: string) {
    commitPlan({
      ...plan,
      days: plan.days.map((day) => (day.id === dayId ? { ...day, name: value } : day)),
    });
  }

  function addDay() {
    const nextIndex = plan.days.length + 1;
    const nextDay: TrainingDayTemplate = {
      id: `${plan.planType}-day-${Date.now()}`,
      name: `Day ${nextIndex}`,
      focus: ['全身'],
      sourceUrl: '',
      exerciseIds: [],
      coachNotes: [],
    };

    commitPlan({ ...plan, days: [...plan.days, nextDay] });
    setExpandedDayIds((current) => new Set(current).add(nextDay.id));
    setPickerDayId(nextDay.id);
  }

  function removeDay(dayId: string) {
    if (plan.days.length <= 1) {
      return;
    }

    const nextDays = plan.days.filter((day) => day.id !== dayId);
    commitPlan({ ...plan, days: nextDays });
    setExpandedDayIds((current) => {
      const next = new Set(current);
      next.delete(dayId);
      return next;
    });
    if (pickerDayId === dayId) {
      setPickerDayId(nextDays[0]?.id);
    }
  }

  function addExerciseToDay(dayId: string, exerciseId: string) {
    commitPlan({
      ...plan,
      days: plan.days.map((day) =>
        day.id === dayId && !day.exerciseIds.includes(exerciseId)
          ? { ...day, exerciseIds: [...day.exerciseIds, exerciseId] }
          : day,
      ),
    });
    setAddQuery('');
    setAddFilter('全部');
  }

  function removeExerciseFromDay(dayId: string, exerciseId: string) {
    commitPlan({
      ...plan,
      days: plan.days.map((day) =>
        day.id === dayId ? { ...day, exerciseIds: day.exerciseIds.filter((item) => item !== exerciseId) } : day,
      ),
    });
  }

  return (
    <section className="screen">
      <article className="source-panel">
        <p className="eyebrow">{editable ? '我的计划' : plan.coachName}</p>
        {editable ? (
          <input
            className="plan-title-input"
            value={plan.title}
            onChange={(event) => updatePlanField('title', event.target.value)}
            aria-label="计划标题"
            placeholder="给计划起个名字"
          />
        ) : (
          <h2>{plan.title}</h2>
        )}
        {editable ? (
          <textarea
            className="plan-description-input"
            value={plan.description}
            onChange={(event) => updatePlanField('description', event.target.value)}
            aria-label="计划描述"
            rows={2}
            placeholder="备注（可选）：训练目标、节奏…"
          />
        ) : (
          <p>{plan.description}</p>
        )}
        {!editable && plan.sourceUrl ? (
          <a href={plan.sourceUrl} target="_blank" rel="noreferrer">
            打开原视频合集
          </a>
        ) : null}
      </article>

      <div className="plan-days">
        {plan.days.map((day) => {
          const isExpanded = expandedDayIds.has(day.id);
          return (
          <article className={isExpanded ? 'training-day-card active' : 'training-day-card'} key={day.id}>
            <button
              type="button"
              className="training-day-toggle"
              onClick={() => {
                toggleDay(day.id);
                if (editable) {
                  setPickerDayId(day.id);
                }
              }}
              aria-expanded={isExpanded}
              aria-label={day.name}
            >
              <div>
                <h3>{day.name}</h3>
                <p>{day.focus.join(' / ')}</p>
              </div>
              <span className="training-day-meta">
                <span>{day.exerciseIds.length} 个动作</span>
                <span className="training-day-chevron" aria-hidden="true">{isExpanded ? '▴' : '▾'}</span>
              </span>
            </button>
            {isExpanded ? (
              <div className="training-day-body">
                {editable ? (
                  <div className="editable-day-bar">
                    <input
                      value={day.name}
                      onChange={(event) => updateDayName(day.id, event.target.value)}
                      aria-label={`${day.name}名称`}
                    />
                    <button type="button" className="secondary-button" onClick={() => removeDay(day.id)} disabled={plan.days.length <= 1}>
                      删除训练日
                    </button>
                  </div>
                ) : null}
                <ol className="training-day-list">
                  {day.exerciseIds.map((exerciseId) => {
                    const exercise = getExerciseById(exerciseId);
                    return (
                      <li key={exerciseId}>
                        <span>{exercise?.name ?? exerciseId}</span>
                        {editable ? (
                          <button
                            type="button"
                            className="inline-remove-button"
                            onClick={() => removeExerciseFromDay(day.id, exerciseId)}
                            aria-label={`从${day.name}删除${exercise?.name ?? exerciseId}`}
                          >
                            删除
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
                {editable ? (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setPickerDayId(day.id);
                      document
                        .getElementById('exercise-picker-panel')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                  >
                    + 给「{day.name}」加动作
                  </button>
                ) : null}
                <div className="card-actions">
                  {!editable && day.sourceUrl ? (
                    <a href={day.sourceUrl} target="_blank" rel="noreferrer">
                      视频
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => onStartWorkout(plan, day)}
                    disabled={day.exerciseIds.length === 0}
                  >
                    开始训练
                  </button>
                </div>
              </div>
            ) : null}
          </article>
          );
        })}
      </div>

      {editable ? (
        <div className="plan-editor-tools">
          <button type="button" className="secondary-button" onClick={addDay}>
            新增训练日
          </button>
          <section className="workout-add-panel" id="exercise-picker-panel" aria-label="从动作库添加到自定义计划">
            <div className="section-title">
              <h2>添加动作</h2>
              <span>加入：{plan.days.find((day) => day.id === pickerDayId)?.name ?? '未选择'}</span>
            </div>
            <input
              value={addQuery}
              onChange={(event) => setAddQuery(event.target.value)}
              placeholder="搜索要加入的动作"
            />
            <div className="filter-pills compact" aria-label="自定义计划肌群筛选">
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
                const currentDay = plan.days.find((day) => day.id === pickerDayId);
                const isAdded = currentDay?.exerciseIds.includes(exercise.id) ?? false;

                return (
                  <article className="exercise-add-card" key={exercise.id}>
                    <div>
                      <strong>{exercise.name}</strong>
                      <span>{exercise.muscleGroups.join(' / ')} · {exercise.equipment}</span>
                    </div>
                    <button
                      type="button"
                      disabled={!currentDay || isAdded}
                      onClick={() => addExerciseToDay(pickerDayId, exercise.id)}
                      aria-label={isAdded ? `${exercise.name}已在当前训练日` : `将${exercise.name}加入当前训练日`}
                    >
                      {isAdded ? '已加入' : '加入'}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function WorkoutView({
  plan,
  session,
  onChange,
  onFinish,
}: {
  plan: CoachPlan;
  session: WorkoutSession;
  onChange: (session: WorkoutSession) => void;
  onFinish: () => void;
}) {
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [addFilter, setAddFilter] = useState<ExerciseFilter>('全部');
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
    const sessions = loadSessions();
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

  function updateSet(exerciseIndex: number, setIndex: number, patch: Partial<SetLog>) {
    const previousSet = session.exerciseLogs[exerciseIndex]?.sets[setIndex];
    const justCompleted = patch.completed === true && previousSet && !previousSet.completed;

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
        <RestTimer initialSeconds={restSeconds} onClose={() => setRestSeconds(null)} />
      ) : null}

      <div className="workout-tools">
        <button type="button" className="secondary-button" onClick={() => setIsAddingExercise(!isAddingExercise)}>
          添加动作
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
            {coachNote ? <CoachCueCard note={coachNote} /> : null}

            <div className="set-grid">
              <span>组</span>
              <span>重量</span>
              <span>次数</span>
              <span>完成</span>
              {log.sets.map((set, setIndex) => (
                <SetRow
                  key={set.setNumber}
                  set={set}
                  lastSet={lastSetsByExercise[log.exerciseId]?.[setIndex]}
                  onChange={(patch) => updateSet(exerciseIndex, setIndex, patch)}
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

function CoachCueCard({ note }: { note: CoachExerciseNote }) {
  return (
    <details className="coach-cue-card" open>
      <summary>
        <span>名师要点</span>
      </summary>
      <div className="coach-cue-body">
        {note.imageUrl ? (
          <img className="coach-cue-shot" src={withBase(note.imageUrl)} alt={`${note.sourceTitle} 视频截图`} loading="lazy" />
        ) : null}
        <div className="coach-cue-copy">
          <p>{note.goal}</p>
          <div>
            <h4>跟练提示</h4>
            <ul>
              {note.keyCues.map((cue) => (
                <li key={cue}>{cue}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4>避免</h4>
            <ul>
              {note.commonMistakes.map((mistake) => (
                <li key={mistake}>{mistake}</li>
              ))}
            </ul>
          </div>
          {note.regression ? <p className="regression-note">{note.regression}</p> : null}
          <a href={note.sourceUrl} target="_blank" rel="noreferrer">
            {note.sourceTitle}
          </a>
        </div>
      </div>
    </details>
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

function RestTimer({ initialSeconds, onClose }: { initialSeconds: number; onClose: () => void }) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [running, setRunning] = useState(true);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!running) {
      return;
    }
    const timer = window.setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (seconds === 0 && !doneRef.current) {
      doneRef.current = true;
      setRunning(false);
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(200);
      }
      playBeep();
    }
  }, [seconds]);

  function adjust(delta: number) {
    doneRef.current = false;
    setSeconds((current) => Math.max(0, current + delta));
    setRunning(true);
  }

  const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
  const ss = (seconds % 60).toString().padStart(2, '0');

  return (
    <div className={seconds === 0 ? 'rest-timer done' : 'rest-timer'} role="timer" aria-label="组间休息计时器">
      <div className="rest-timer-display">
        <span className="rest-timer-time">{mm}:{ss}</span>
        <span className="rest-timer-hint">{seconds === 0 ? '休息结束' : '组间休息'}</span>
      </div>
      <div className="rest-timer-controls">
        <button type="button" onClick={() => adjust(-15)} aria-label="减少 15 秒">-15s</button>
        <button type="button" onClick={() => setRunning((value) => !value)} aria-label={running ? '暂停休息' : '继续休息'}>
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
  set,
  lastSet,
  onChange,
}: {
  set: SetLog;
  lastSet?: { weight: number | null; reps: number | null };
  onChange: (patch: Partial<SetLog>) => void;
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
    <>
      <strong>{set.setNumber}</strong>
      <div className="stepper">
        <button type="button" onClick={() => stepWeight(-2.5)} aria-label={`第 ${set.setNumber} 组重量减 2.5`}>−</button>
        <input
          inputMode="decimal"
          aria-label={`第 ${set.setNumber} 组重量`}
          value={set.weight ?? ''}
          placeholder={weightHint}
          onChange={(event) => onChange({ weight: parseOptionalNumber(event.target.value) })}
        />
        <button type="button" onClick={() => stepWeight(2.5)} aria-label={`第 ${set.setNumber} 组重量加 2.5`}>＋</button>
      </div>
      <div className="stepper">
        <button type="button" onClick={() => stepReps(-1)} aria-label={`第 ${set.setNumber} 组次数减 1`}>−</button>
        <input
          inputMode="numeric"
          aria-label={`第 ${set.setNumber} 组次数`}
          value={set.reps ?? ''}
          placeholder={repsHint}
          onChange={(event) => onChange({ reps: parseOptionalNumber(event.target.value) })}
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
    </>
  );
}

function ExerciseLibrary({
  query,
  filter,
  onQueryChange,
  onFilterChange,
}: {
  query: string;
  filter: ExerciseFilter;
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: ExerciseFilter) => void;
}) {
  const results = useMemo(() => filterExercises(query, filter), [filter, query]);
  const muscleFilters: ExerciseFilter[] = ['全部', '胸', '背', '肩', '腿', '手臂'];

  return (
    <section className="screen with-nav">
      <div className="search-panel">
        <input
          id="exercise-search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="⌕ 搜索动作"
        />
      </div>
      <div className="filter-pills" aria-label="肌群筛选预览">
        {muscleFilters.map((filterOption) => (
          <button
            key={filterOption}
            type="button"
            className={filterOption === filter ? 'active' : ''}
            onClick={() => onFilterChange(filterOption)}
          >
            {filterOption}
          </button>
        ))}
      </div>

      <div className="exercise-list">
        {results.map((exercise) => (
          <details className="exercise-card" key={exercise.id}>
            <summary>
              <span>{exercise.name}</span>
              <small>{exercise.muscleGroups.join(' / ')} · {exercise.equipment}</small>
            </summary>
            <div className="detail-grid">
              <div>
                <h4>要领</h4>
                <ul>
                  {exercise.cues.map((cue) => (
                    <li key={cue}>{cue}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>常见错误</h4>
                <ul>
                  {exercise.commonMistakes.map((mistake) => (
                    <li key={mistake}>{mistake}</li>
                  ))}
                </ul>
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function History({ sessions }: { sessions: WorkoutSession[] }) {
  const personalRecords = useMemo(() => getPersonalRecords(sessions), [sessions]);
  const weekly = useMemo(() => getWeeklyStats(sessions), [sessions]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');

  const trackedExerciseId = selectedExerciseId || personalRecords[0]?.exerciseId || '';
  const progress = useMemo(
    () => (trackedExerciseId ? getExerciseProgress(sessions, trackedExerciseId) : []),
    [sessions, trackedExerciseId],
  );

  if (sessions.length === 0) {
    return (
      <section className="screen with-nav">
        <div className="section-title">
          <h2>训练历史</h2>
          <span>0 次</span>
        </div>
        <div className="empty-state">还没有训练记录。进入计划并完成一次训练后会自动保存。</div>
      </section>
    );
  }

  return (
    <section className="screen with-nav">
      <section className="section-block">
        <div className="section-title">
          <h2>本周概览</h2>
          <span>近 7 天</span>
        </div>
        <div className="stat-grid">
          <StatTile label="训练次数" value={weekly.recentSessions} delta={weekly.recentSessions - weekly.previousSessions} />
          <StatTile label="完成组数" value={weekly.recentCompletedSets} delta={weekly.recentCompletedSets - weekly.previousCompletedSets} />
          <StatTile label="总容量 (kg)" value={Math.round(weekly.recentVolume)} delta={Math.round(weekly.recentVolume - weekly.previousVolume)} />
        </div>
      </section>

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
          {sessions.map((session) => (
            <article className="history-card" key={session.id}>
              <div>
                <strong>{findDayName(session)}</strong>
                <span>{formatDate(session.date)}</span>
              </div>
              <p>{summarizeSession(session)}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function StatTile({ label, value, delta }: { label: string; value: number; delta: number }) {
  const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const deltaLabel = delta === 0 ? '持平' : `${delta > 0 ? '+' : ''}${delta}`;
  return (
    <div className="stat-tile">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      <span className={`stat-delta ${trend}`}>{deltaLabel}</span>
    </div>
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

function BottomNav({ activeTab, onChange }: { activeTab: Tab; onChange: (tab: Tab) => void }) {
  const tabs: Array<{ id: Tab; label: string; icon: string }> = [
    { id: 'plans', label: '计划', icon: '⌂' },
    { id: 'exercises', label: '动作库', icon: '◉' },
    { id: 'history', label: '历史', icon: '▤' },
  ];

  return (
    <nav className="bottom-nav" aria-label="主导航">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={activeTab === tab.id ? 'active' : ''}
          onClick={() => onChange(tab.id)}
        >
          <span>{tab.icon}</span>
          <small>{tab.label}</small>
        </button>
      ))}
    </nav>
  );
}

function getHeaderCopy(
  route: Route,
  activeTab: Tab,
  selectedPlan: CoachPlan | undefined,
  activeDay: TrainingDayTemplate | undefined,
): { title: string; subtitle: string } {
  if (route.name === 'workout') {
    return {
      title: activeDay?.name.split(' ')[0] === 'Day' ? activeDay.name.split(' ').slice(0, 2).join(' ') : '训练中',
      subtitle: activeDay?.focus.join(' / ') ?? '逐组记录重量和次数',
    };
  }

  if (route.name === 'builtin-plan') {
    return {
      title: selectedPlan?.title ? `${selectedPlan.coachName}三分化` : '计划详情',
      subtitle: '增肌 / 三分化循环',
    };
  }

  if (route.name === 'custom-library') {
    return { title: '我的计划', subtitle: '自定义训练库' };
  }

  if (route.name === 'custom-plan') {
    return {
      title: selectedPlan?.title ?? '自定义计划',
      subtitle: '动作库拼装 / 本地保存',
    };
  }

  if (activeTab === 'exercises') {
    return { title: '动作库', subtitle: '搜索动作、肌群和器械' };
  }

  if (activeTab === 'history') {
    return { title: '历史训练', subtitle: '查看过往训练日、动作和逐组数据' };
  }

  return { title: '健身计划', subtitle: '选择一个计划开始训练' };
}

function parseOptionalNumber(value: string): number | null {
  if (value.trim() === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function findDayName(session: WorkoutSession): string {
  const currentPlan = [...coachPlans, ...loadCustomPlans()].find((item) => item.id === session.planId);
  return currentPlan?.days.find((day) => day.id === session.dayId)?.name ?? '训练记录';
}

function findCoachNote(day: TrainingDayTemplate, exerciseId: string): CoachExerciseNote | undefined {
  return day.coachNotes.find((note) => note.exerciseId === exerciseId);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

// 把 data.ts 里以 / 开头的静态资源路径拼上 Vite 的部署基路径，
// 以支持 GitHub Pages 子路径(/fitness-pwa/)。开发/测试环境 BASE_URL 为 /，结果不变。
function withBase(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path}`;
}

function formatDateShort(date: string): string {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(new Date(date));
}

function summarizeSession(session: WorkoutSession): string {
  const completedSets = session.exerciseLogs.flatMap((log: ExerciseLog) => log.sets).filter((set) => set.completed).length;
  const totalSets = session.exerciseLogs.flatMap((log: ExerciseLog) => log.sets).length;
  return `${session.exerciseLogs.length} 个动作 · ${completedSets}/${totalSets} 组完成`;
}

export default App;
