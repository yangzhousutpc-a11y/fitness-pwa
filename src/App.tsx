import { useEffect, useMemo, useRef, useState } from 'react';
import { CoachCueCard } from './components/CoachCueCard';
import { ExerciseDetail } from './components/ExerciseDetail';
import { History } from './components/History';
import { MetricCard } from './components/MetricCard';
import { WorkoutView } from './components/WorkoutView';
import { setApiToken } from './auth';
import { coachPlans, filterExercises, getExerciseById } from './data';
import {
  getExercisePerformanceSummary,
  getPersonalRecords,
  getWeeklyStats,
} from './analytics';
import {
  AuthError,
  deleteCustomPlan as deleteCustomPlanFromApi,
  deleteWorkoutSession as deleteWorkoutSessionFromApi,
  getCurrentPlanPreference,
  getCustomPlans,
  getWorkoutSessions,
  saveCurrentPlanPreference,
  saveCustomPlan,
  saveWorkoutSession,
} from './api';
import {
  createEmptyCustomPlan,
  loadWorkoutDrafts,
  removeWorkoutDraft,
  saveWorkoutDraft,
  createSessionFromHistory,
  createSessionFromDay,
} from './storage';
import type { CoachPlan, TrainingDayTemplate, WorkoutSession } from './types';
import {
  findCoachNote,
  findDayName,
  formatDate,
  formatDateShort,
  formatSetLabel,
  formatWeight,
  getDailyTrainingQuote,
  getDateKey,
  getExerciseImageUrl,
  getUnifiedCustomDay,
  getWorkoutDraftKey,
  normalizeCustomPlan,
  withBase,
} from './utils';

type Tab = 'plans' | 'exercises' | 'history';
type ExerciseFilter = '全部' | '胸' | '背' | '肩' | '腿' | '手臂';

type RecommendedWorkout = {
  plan: CoachPlan;
  day: TrainingDayTemplate;
  reason: string;
};
type Route =
  | { name: 'home' }
  | { name: 'custom-library' }
  | { name: 'builtin-plan'; planId: string; expandedDayId?: string }
  | { name: 'custom-plan'; planId: string; expandedDayId?: string }
  | { name: 'exercise-detail'; exerciseId: string }
  | { name: 'workout'; planKind: 'builtin' | 'custom'; planId: string; dayId: string; session: WorkoutSession };
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const INSTALL_PROMPT_DISMISSED_KEY = 'fitness-pwa.install-prompt-dismissed.v1';
const UI_THEME = 'dark-log';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('plans');
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [workoutDrafts, setWorkoutDrafts] = useState<Record<string, WorkoutSession>>(() => loadWorkoutDrafts());
  const [pendingReuseSession, setPendingReuseSession] = useState<WorkoutSession | null>(null);
  const [customPlans, setCustomPlans] = useState<CoachPlan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [syncError, setSyncError] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [apiTokenDraft, setApiTokenDraft] = useState('');
  const [isWorkoutInputFocused, setIsWorkoutInputFocused] = useState(false);
  const [exerciseQuery, setExerciseQuery] = useState('');
  const [exerciseFilter, setExerciseFilter] = useState<ExerciseFilter>('全部');

  useEffect(() => {
    loadDatabaseState();
  }, []);

  function reportSyncError(error: unknown) {
    setSyncStatus('error');
    setSyncError(error instanceof Error ? error.message : '数据库同步失败');
    setShowLogin(true);
  }

  // 写操作失败：先回滚本地态再提示，避免静默骗用户。
  // 仅当是鉴权失败（AuthError/401）时才回到登录页；普通保存失败只显示可重试的横幅，不打断训练流程。
  function reportWriteError(error: unknown, rollback: () => void) {
    rollback();
    const message = error instanceof Error ? error.message : '数据库同步失败';
    setSyncStatus('error');
    setSyncError(message);
    if (error instanceof AuthError) {
      setShowLogin(true);
    }
  }

  function loadDatabaseState() {
    setSyncStatus('loading');
    setSyncError('');
    Promise.all([getCustomPlans(), getWorkoutSessions(), getCurrentPlanPreference()])
      .then(([nextCustomPlans, nextSessions, nextPreference]) => {
        setCustomPlans(nextCustomPlans);
        setSessions(nextSessions);
        setCurrentPlanId(nextPreference.planId);
        setSyncStatus('ready');
        setShowLogin(false);
      })
      .catch(reportSyncError);
  }

  function saveAccessKey() {
    const token = apiTokenDraft.trim();
    if (!token) {
      setSyncStatus('error');
      setSyncError('请输入访问密钥');
      setShowLogin(true);
      return;
    }

    setApiToken(token);
    setApiTokenDraft('');
    loadDatabaseState();
  }

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
  const isWorkoutRoute = route.name === 'workout';

  useEffect(() => {
    if (!isWorkoutRoute) {
      setIsWorkoutInputFocused(false);
    }
  }, [isWorkoutRoute]);

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

  function openExerciseDetail(exerciseId: string) {
    setActiveTab('exercises');
    setRoute({ name: 'exercise-detail', exerciseId });
  }

  function createCustomPlan() {
    const nextPlan = createEmptyCustomPlan();
    setCustomPlans((current) => [nextPlan, ...current]);
    setActiveTab('plans');
    setRoute({ name: 'custom-plan', planId: nextPlan.id, expandedDayId: nextPlan.days[0]?.id });
  }

  function deleteCustomPlan(planId: string) {
    setCustomPlans((current) => current.filter((item) => item.id !== planId));
    deleteCustomPlanFromApi(planId).catch(reportSyncError);
    if (route.name === 'custom-plan' && route.planId === planId) {
      setRoute({ name: 'custom-library' });
      setActiveTab('plans');
    }
  }

  function startWorkout(currentPlan: CoachPlan, day: TrainingDayTemplate) {
    const draftKey = getWorkoutDraftKey(currentPlan.id, day.id);
    setRoute({
      name: 'workout',
      planKind: currentPlan.planType,
      planId: currentPlan.id,
      dayId: day.id,
      session: workoutDrafts[draftKey] ?? createSessionFromDay(currentPlan, day),
    });
  }

  function updateSession(nextSession: WorkoutSession) {
    if (route.name === 'workout') {
      const draftKey = getWorkoutDraftKey(route.planId, route.dayId);
      setWorkoutDrafts(saveWorkoutDraft(draftKey, nextSession));
      setRoute({ ...route, session: nextSession });
    }
  }

  function finishWorkout(session: WorkoutSession) {
    // 记录这条 id 之前的版本（复用历史记录时可能已存在），仅回滚这一条，避免快照覆盖其它并发变更。
    const previousVersion = sessions.find((item) => item.id === session.id) ?? null;
    setSessions((current) => [session, ...current.filter((item) => item.id !== session.id)]);
    const draftKey = route.name === 'workout' ? getWorkoutDraftKey(route.planId, route.dayId) : null;
    saveWorkoutSession(session)
      .then(() => {
        // 仅在确认写入成功后才删草稿，失败时草稿保留供重试。
        if (draftKey) {
          setWorkoutDrafts(removeWorkoutDraft(draftKey));
        }
      })
      .catch((error) =>
        reportWriteError(error, () =>
          setSessions((current) => {
            const withoutThis = current.filter((item) => item.id !== session.id);
            return previousVersion ? [previousVersion, ...withoutThis] : withoutThis;
          }),
        ),
      );
    setActiveTab('history');
    setRoute({ name: 'home' });
  }

  function findSessionPlan(session: WorkoutSession): CoachPlan | undefined {
    return [...coachPlans, ...customPlans].find((item) => item.id === session.planId);
  }

  function openReusedSession(sourceSession: WorkoutSession) {
    const sourcePlan = findSessionPlan(sourceSession);
    const sourceDay = sourcePlan?.days.find((day) => day.id === sourceSession.dayId);
    if (!sourcePlan || !sourceDay) {
      reportSyncError(new Error('找不到原训练计划，无法复用这次记录'));
      return;
    }

    const nextSession = createSessionFromHistory(sourceSession);
    const draftKey = getWorkoutDraftKey(nextSession.planId, nextSession.dayId);
    setWorkoutDrafts(saveWorkoutDraft(draftKey, nextSession));
    setActiveTab('plans');
    setRoute({
      name: 'workout',
      planKind: sourcePlan.planType,
      planId: nextSession.planId,
      dayId: nextSession.dayId,
      session: nextSession,
    });
  }

  function reuseSessionForToday(sourceSession: WorkoutSession) {
    const draftKey = getWorkoutDraftKey(sourceSession.planId, sourceSession.dayId);
    if (workoutDrafts[draftKey]) {
      setPendingReuseSession(sourceSession);
      return;
    }

    openReusedSession(sourceSession);
  }

  function changeCurrentPlan(planId: string) {
    const previousPlanId = currentPlanId;
    setCurrentPlanId(planId);
    saveCurrentPlanPreference(planId).catch((error) => {
      setCurrentPlanId(previousPlanId);
      reportSyncError(error);
    });
  }

  function deleteSession(sessionId: string) {
    const previousSessions = sessions;
    setSessions((current) => current.filter((item) => item.id !== sessionId));
    deleteWorkoutSessionFromApi(sessionId).catch((error) => {
      setSessions(previousSessions);
      reportSyncError(error);
    });
  }

  function updateCustomPlan(nextPlan: CoachPlan) {
    const previousVersion = customPlans.find((item) => item.id === nextPlan.id) ?? null;
    setCustomPlans((current) => [nextPlan, ...current.filter((item) => item.id !== nextPlan.id)]);
    saveCustomPlan(nextPlan).catch((error) =>
      reportWriteError(error, () =>
        setCustomPlans((current) => {
          const withoutThis = current.filter((item) => item.id !== nextPlan.id);
          return previousVersion ? [previousVersion, ...withoutThis] : withoutThis;
        }),
      ),
    );
  }

  function goHome(tab: Tab = activeTab) {
    setActiveTab(tab);
    setRoute({ name: 'home' });
  }

  // 标题为空且所有训练日都没有动作 → 视为"没真正建起来"的空计划。
  function isEmptyCustomPlan(plan: CoachPlan): boolean {
    const hasTitle = plan.title.trim().length > 0;
    const hasExercise = plan.days.some((day) => day.exerciseIds.length > 0);
    return !hasTitle && !hasExercise;
  }

  function discardIfEmpty(planId: string) {
    setCustomPlans((current) => {
      const discardedPlan = current.find((item) => item.id === planId && isEmptyCustomPlan(item));
      if (discardedPlan) {
        deleteCustomPlanFromApi(planId).catch(reportSyncError);
      }
      return current.filter((item) => !(item.id === planId && isEmptyCustomPlan(item)));
    });
  }

  function goBack() {
    if (route.name === 'exercise-detail') {
      setActiveTab('exercises');
      setRoute({ name: 'home' });
      return;
    }

    setActiveTab('plans');
    if (route.name === 'custom-plan') {
      // 离开编辑器时，若是没填任何内容的空计划，自动丢弃，避免留下"未命名计划"垃圾卡。
      discardIfEmpty(route.planId);
      setRoute({ name: 'custom-library' });
      return;
    }
    if (route.name === 'workout') {
      if (route.planKind === 'custom') {
        setRoute({ name: 'custom-plan', planId: route.planId, expandedDayId: route.dayId });
      } else {
        setRoute({ name: 'builtin-plan', planId: route.planId, expandedDayId: route.dayId });
      }
      return;
    }
    setRoute({ name: 'home' });
  }

  const appShellClassName = isWorkoutRoute && isWorkoutInputFocused ? 'app-shell input-focus-mode' : 'app-shell';

  if (showLogin) {
    return (
      <main className="app-shell login-shell" data-ui-theme={UI_THEME}>
        <LoginScreen
          status={syncStatus}
          error={syncError}
          tokenDraft={apiTokenDraft}
          onTokenDraftChange={setApiTokenDraft}
          onSaveToken={saveAccessKey}
          onRetry={loadDatabaseState}
        />
      </main>
    );
  }

  return (
    <main className={appShellClassName} data-ui-theme={UI_THEME}>
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

      <SyncStatusBanner
        status={syncStatus}
        error={syncError}
        onRetry={loadDatabaseState}
      />

      {syncStatus === 'ready' && route.name === 'home' && activeTab === 'plans' ? <InstallAppPrompt /> : null}

      {route.name === 'home' && activeTab === 'plans' ? (
        <PlanHome
          builtinPlans={coachPlans}
          customPlanCount={customPlans.length}
          currentPlanId={currentPlanId}
          sessions={sessions}
          customPlans={customPlans}
          onOpenPlan={(plan, expandedDayId) => {
            if (plan.planType === 'custom') {
              openCustomPlan(plan.id, expandedDayId);
              return;
            }
            openBuiltinPlan(plan.id, expandedDayId);
          }}
          onOpenCustomLibrary={openCustomLibrary}
          onSetCurrentPlan={changeCurrentPlan}
          onOpenHistory={() => {
            setActiveTab('history');
            setRoute({ name: 'home' });
          }}
          onStartWorkout={startWorkout}
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
          sessions={sessions}
          onQueryChange={setExerciseQuery}
          onFilterChange={setExerciseFilter}
          onOpenExercise={openExerciseDetail}
        />
      ) : null}
      {route.name === 'exercise-detail' ? (
        <ExerciseDetail exerciseId={route.exerciseId} sessions={sessions} />
      ) : null}
      {route.name === 'home' && activeTab === 'history' ? (
        <History
          sessions={sessions}
          customPlans={customPlans}
          onDeleteSession={deleteSession}
          onReuseSession={reuseSessionForToday}
        />
      ) : null}
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
          sessions={sessions}
          onChange={updateSession}
          onFinish={() => finishWorkout(route.session)}
          onInputFocusChange={setIsWorkoutInputFocused}
        />
      ) : null}

      <BottomNav
        activeTab={activeTab}
        onChange={(tab) => {
          if (!isWorkoutRoute) {
            setActiveTab(tab);
            setRoute({ name: 'home' });
          }
        }}
      />

      {pendingReuseSession ? (
        <ReuseDraftConfirm
          sessionName={findDayName(pendingReuseSession, customPlans)}
          onCancel={() => setPendingReuseSession(null)}
          onConfirm={() => {
            const sourceSession = pendingReuseSession;
            setPendingReuseSession(null);
            openReusedSession(sourceSession);
          }}
        />
      ) : null}
    </main>
  );
}

function ReuseDraftConfirm({
  sessionName,
  onCancel,
  onConfirm,
}: {
  sessionName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="reuse-confirm-backdrop" role="presentation" onClick={onCancel}>
      <section
        className="reuse-confirm-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="确认复用历史训练"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="reuse-confirm-head">
          <div>
            <strong>复用到今天</strong>
            <span>已有未完成的 {sessionName} 草稿，继续会用历史记录覆盖它。</span>
          </div>
        </div>
        <div className="reuse-confirm-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>取消</button>
          <button type="button" className="primary-button" onClick={onConfirm}>继续复用</button>
        </div>
      </section>
    </div>
  );
}

function isStandaloneApp() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
}

function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(isStandaloneApp);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY) === '1');

  useEffect(() => {
    const standaloneQuery = window.matchMedia?.('(display-mode: standalone)');
    const updateStandalone = () => setIsStandalone(isStandaloneApp());
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, '1');
      setDismissed(true);
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    updateStandalone();
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    standaloneQuery?.addEventListener('change', updateStandalone);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      standaloneQuery?.removeEventListener('change', updateStandalone);
    };
  }, []);

  if (isStandalone || dismissed) {
    return null;
  }

  async function installApp() {
    if (!deferredPrompt) {
      localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, '1');
      setDismissed(true);
      return;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice.catch(() => ({ outcome: 'dismissed' as const, platform: '' }));
    if (choice.outcome === 'accepted') {
      localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, '1');
      setDismissed(true);
    }
    setDeferredPrompt(null);
  }

  function dismissPrompt() {
    localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, '1');
    setDismissed(true);
  }

  return (
    <section className="install-app-prompt" aria-label="添加到主屏幕提示">
      <div>
        <strong>添加到主屏幕</strong>
        <p>从桌面图标打开，训练时就像独立 App。iPhone 可用分享菜单添加。</p>
      </div>
      <div className="install-app-actions">
        <button type="button" className="ghost-button compact" onClick={dismissPrompt}>稍后</button>
        <button type="button" className="primary-button compact" onClick={installApp}>
          {deferredPrompt ? '安装' : '我知道了'}
        </button>
      </div>
    </section>
  );
}

function SyncStatusBanner({
  status,
  error,
  onRetry,
}: {
  status: 'loading' | 'ready' | 'error';
  error: string;
  onRetry: () => void;
}) {
  if (status === 'ready') {
    return null;
  }

  if (status === 'loading') {
    return <div className="sync-banner">正在同步数据库…</div>;
  }

  return <div className="sync-banner error" role="alert">
    <span>{error || '数据库同步失败'}</span>
    <button type="button" onClick={onRetry}>重试</button>
  </div>;
}

function LoginScreen({
  status,
  error,
  tokenDraft,
  onTokenDraftChange,
  onSaveToken,
  onRetry,
}: {
  status: 'loading' | 'ready' | 'error';
  error: string;
  tokenDraft: string;
  onTokenDraftChange: (value: string) => void;
  onSaveToken: () => void;
  onRetry: () => void;
}) {
  const isLoading = status === 'loading';

  return (
    <section className="login-screen" aria-label="访问密钥登录">
      <div className="login-brand">
        <span>私人训练记录</span>
        <h1>力量日记</h1>
        <p>输入访问密钥后同步你的训练数据</p>
      </div>

      <form
        className="login-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSaveToken();
        }}
      >
        <label>
          <span>访问密钥</span>
          <input
            aria-label="访问密钥"
            type="password"
            inputMode="text"
            placeholder="输入访问密钥"
            value={tokenDraft}
            disabled={isLoading}
            onChange={(event) => onTokenDraftChange(event.target.value)}
          />
        </label>

        {error ? <p className="login-error" role="alert">{error}</p> : null}

        <button type="submit" className="login-primary" disabled={isLoading}>
          {isLoading ? '连接中...' : '进入'}
        </button>
        <button type="button" className="login-secondary" disabled={isLoading} onClick={onRetry}>
          重试连接
        </button>
      </form>
    </section>
  );
}

function PlanHome({
  builtinPlans,
  customPlanCount,
  currentPlanId,
  sessions,
  customPlans,
  onOpenPlan,
  onOpenCustomLibrary,
  onSetCurrentPlan,
  onOpenHistory,
  onStartWorkout,
}: {
  builtinPlans: CoachPlan[];
  customPlanCount: number;
  currentPlanId: string | null;
  sessions: WorkoutSession[];
  customPlans: CoachPlan[];
  onOpenPlan: (plan: CoachPlan, expandedDayId?: string) => void;
  onOpenCustomLibrary: () => void;
  onSetCurrentPlan: (planId: string) => void;
  onOpenHistory: () => void;
  onStartWorkout: (currentPlan: CoachPlan, day: TrainingDayTemplate) => void;
}) {
  const latestSession = sessions[0];
  const weekly = useMemo(() => getWeeklyStats(sessions), [sessions]);
  const personalRecords = useMemo(() => getPersonalRecords(sessions), [sessions]);
  // 首页只放速览：PR 取前 3，看全部去历史页。
  const topRecords = personalRecords.slice(0, 3);
  const recommendedWorkout = useMemo(
    () => getRecommendedWorkout(sessions, builtinPlans, customPlans, currentPlanId),
    [sessions, builtinPlans, customPlans, currentPlanId],
  );
  const recommendedDayParts = recommendedWorkout ? splitDayTitle(recommendedWorkout.day.name) : null;

  return (
    <section className="screen with-nav home-screen">
      {!recommendedWorkout || !recommendedDayParts ? (
        <article className="primary-training-card current-plan-empty">
          <span className="entry-eyebrow">选择当前跟练计划</span>
          <h2>
            <span>当前跟练</span>
            未设置
          </h2>
          <p>先在下方选择一个名师计划设为当前跟练</p>
        </article>
      ) : recommendedWorkout && recommendedDayParts ? (
        <article className="primary-training-card">
          <span className="entry-eyebrow">下一次训练</span>
          <h2>
            <span>{recommendedDayParts.prefix}</span>
            {recommendedDayParts.title}
          </h2>
          <p>{recommendedWorkout.reason}</p>
          <div className="primary-training-actions">
            <button
              type="button"
              className="recommended-start-button"
              onClick={() => onStartWorkout(recommendedWorkout.plan, recommendedWorkout.day)}
              aria-label="开始推荐训练"
            >
              开始训练
            </button>
            <button
              type="button"
              className="recommended-adjust-button"
              onClick={() => onOpenPlan(recommendedWorkout.plan, recommendedWorkout.day.id)}
              aria-label="调整推荐训练选择"
            >
              调整选择
            </button>
          </div>
        </article>
      ) : null}

      <section className="home-plan-picker">
        <div className="section-title">
          <h2>选择训练计划</h2>
          <span>查看全部</span>
        </div>
        <div className="plan-choice-list">
          {builtinPlans.map((plan) => {
            const isCurrentPlan = currentPlanId === plan.id;
            return (
              <article
                className={isCurrentPlan ? 'plan-choice-card primary' : 'plan-choice-card'}
                key={plan.id}
              >
                <span>
                  <small>{isCurrentPlan ? '当前跟练' : '名师计划'}</small>
                  <strong>{plan.title}</strong>
                  <em>{getPlanChoiceSummary(plan)}</em>
                </span>
                <div className="plan-choice-actions">
                  {isCurrentPlan ? <span className="current-plan-badge">当前跟练</span> : (
                    <button
                      type="button"
                      className="set-current-plan-button"
                      onClick={() => onSetCurrentPlan(plan.id)}
                      aria-label={`设为当前跟练${plan.title}`}
                    >
                      设为当前
                    </button>
                  )}
                  <button
                    type="button"
                    className="plan-choice-open"
                    aria-label={`进入${plan.title}`}
                    onClick={() => onOpenPlan(plan, plan.days[0]?.id)}
                  >
                    ›
                  </button>
                </div>
              </article>
            );
          })}

          <button
            type="button"
            className="plan-choice-card"
            aria-label="进入我的计划"
            onClick={onOpenCustomLibrary}
          >
            <span>
              <small>我的计划</small>
              <strong>自定义训练库</strong>
              <em>{customPlanCount > 0 ? `${customPlanCount} 个计划` : '从动作库自由搭建'}</em>
            </span>
            <b>›</b>
          </button>
        </div>
      </section>

      {sessions.length > 0 ? (
        <section className="section-block home-weekly">
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
        <section className="section-block home-pr">
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

      <section className="section-block home-recent">
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
            <strong>{findDayName(latestSession, customPlans)}</strong>
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
  // 行内二次确认：记录当前处于"确认删除"状态的计划 id，3 秒不点自动复原。
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const confirmTimer = useRef<number | null>(null);

  function askDelete(planId: string) {
    setConfirmingId(planId);
    if (confirmTimer.current) {
      window.clearTimeout(confirmTimer.current);
    }
    confirmTimer.current = window.setTimeout(() => setConfirmingId(null), 3000);
  }

  function confirmDelete(planId: string) {
    if (confirmTimer.current) {
      window.clearTimeout(confirmTimer.current);
    }
    setConfirmingId(null);
    onDeleteCustomPlan(planId);
  }

  useEffect(
    () => () => {
      if (confirmTimer.current) {
        window.clearTimeout(confirmTimer.current);
      }
    },
    [],
  );

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
            <p>点上方「新建自定义计划」，从动作库挑动作、组成一次训练，保存后即可逐组记录。</p>
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
                    <span>{exerciseIds.length} 个动作</span>
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
                    {confirmingId === item.id ? (
                      <button
                        type="button"
                        className="danger-button confirming"
                        onClick={() => confirmDelete(item.id)}
                        aria-label={`确认删除${item.title.trim() || '未命名计划'}`}
                      >
                        确认删除？
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => askDelete(item.id)}
                        aria-label={`删除${item.title.trim() || '未命名计划'}`}
                      >
                        删除
                      </button>
                    )}
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
  const [expandedPlanExerciseIds, setExpandedPlanExerciseIds] = useState<Set<string>>(
    () => new Set(plan.days.flatMap((day) => (day.exerciseIds[0] ? [`${day.id}:${day.exerciseIds[0]}`] : []))),
  );

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

  function togglePlanExercise(dayId: string, exerciseId: string) {
    const key = `${dayId}:${exerciseId}`;
    setExpandedPlanExerciseIds((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
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
    const nextPlan = { ...plan, [field]: value };
    commitPlan(editable ? normalizeCustomPlan(nextPlan) : nextPlan);
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
    // 加完不清空搜索/筛选：让用户在同一筛选下连续添加多个动作（批量添加体验）。
    commitPlan({
      ...plan,
      days: plan.days.map((day) =>
        day.id === dayId && !day.exerciseIds.includes(exerciseId)
          ? { ...day, exerciseIds: [...day.exerciseIds, exerciseId] }
          : day,
      ),
    });
  }

  function removeExerciseFromDay(dayId: string, exerciseId: string) {
    commitPlan({
      ...plan,
      days: plan.days.map((day) =>
        day.id === dayId ? { ...day, exerciseIds: day.exerciseIds.filter((item) => item !== exerciseId) } : day,
      ),
    });
  }

  const customDay = getUnifiedCustomDay(plan);
  const customExerciseIds = customDay.exerciseIds;

  function commitCustomExercises(exerciseIds: string[]) {
    commitPlan(normalizeCustomPlan({ ...plan, days: [{ ...customDay, exerciseIds }] }));
  }

  function addExerciseToCustomPlan(exerciseId: string) {
    if (customExerciseIds.includes(exerciseId)) {
      return;
    }
    commitCustomExercises([...customExerciseIds, exerciseId]);
  }

  function removeExerciseFromCustomPlan(exerciseId: string) {
    commitCustomExercises(customExerciseIds.filter((item) => item !== exerciseId));
  }

  function startCustomWorkout() {
    const nextPlan = normalizeCustomPlan(plan);
    const nextDay = getUnifiedCustomDay(nextPlan);
    commitPlan(nextPlan);
    onStartWorkout(nextPlan, nextDay);
  }

  if (editable) {
    return (
      <section className="screen with-nav">
        <article className="source-panel custom-plan-form">
          <input
            className="plan-title-input"
            value={plan.title}
            onChange={(event) => updatePlanField('title', event.target.value)}
            aria-label="计划标题"
            placeholder="给计划起个名字"
          />
          <textarea
            className="plan-description-input"
            value={plan.description}
            onChange={(event) => updatePlanField('description', event.target.value)}
            aria-label="计划描述"
            rows={2}
            placeholder="备注（可选）：训练目标、节奏…"
          />
        </article>

        <section className="plan-days">
          <article className="training-day-card custom-exercise-card active">
            <div className="training-day-body">
              <div className="section-title">
                <h2>动作列表</h2>
                <span>{customExerciseIds.length} 个动作</span>
              </div>
              {customExerciseIds.length === 0 ? (
                <div className="empty-state">还没有动作，先从动作库添加。</div>
              ) : (
                <ol className="custom-exercise-list">
                  {customExerciseIds.map((exerciseId, index) => {
                    const exercise = getExerciseById(exerciseId);
                    return (
                      <li key={exerciseId}>
                        <span className="custom-exercise-index">{index + 1}</span>
                        <span className="custom-exercise-name">{exercise?.name ?? exerciseId}</span>
                        <button
                          type="button"
                          className="inline-remove-button"
                          onClick={() => removeExerciseFromCustomPlan(exerciseId)}
                          aria-label={`从当前计划删除${exercise?.name ?? exerciseId}`}
                        >
                          删除
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
              <div className="card-actions custom-plan-actions">
                {customExerciseIds.length === 0 ? <span className="start-hint">先加动作才能开始</span> : null}
                <button
                  type="button"
                  className="primary-button custom-start-button"
                  onClick={startCustomWorkout}
                  disabled={customExerciseIds.length === 0}
                >
                  开始训练
                </button>
              </div>
            </div>
          </article>
        </section>

        <div className="plan-editor-tools">
          <section className="workout-add-panel" id="exercise-picker-panel" aria-label="从动作库添加到自定义计划">
            <div className="section-title">
              <h2>添加动作</h2>
              <span>已选 {customExerciseIds.length} 个</span>
            </div>
            <input
              value={addQuery}
              onChange={(event) => setAddQuery(event.target.value)}
              placeholder="搜索要加入的动作（可连续添加多个）"
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
                const isAdded = customExerciseIds.includes(exercise.id);

                return (
                  <article className="exercise-add-card" key={exercise.id}>
                    <div>
                      <strong>{exercise.name}</strong>
                      <span>{exercise.muscleGroups.join(' / ')} · {exercise.equipment}</span>
                    </div>
                    <button
                      type="button"
                      disabled={isAdded}
                      onClick={() => addExerciseToCustomPlan(exercise.id)}
                      aria-label={isAdded ? `${exercise.name}已在当前计划` : `将${exercise.name}加入当前计划`}
                    >
                      {isAdded ? '已加入' : '加入'}
                    </button>
                  </article>
                );
              })}
            </div>
            <button
              type="button"
              className="secondary-button full-width"
              onClick={() => {
                setAddQuery('');
                setAddFilter('全部');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              完成添加，回到动作列表
            </button>
          </section>
        </div>
      </section>
    );
  }

  return (
    <section className="screen with-nav">
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
                {editable ? (
                  <ol className="training-day-list">
                    {day.exerciseIds.map((exerciseId) => {
                      const exercise = getExerciseById(exerciseId);
                      return (
                        <li key={exerciseId}>
                          <span>{exercise?.name ?? exerciseId}</span>
                          <button
                            type="button"
                            className="inline-remove-button"
                            onClick={() => removeExerciseFromDay(day.id, exerciseId)}
                            aria-label={`从${day.name}删除${exercise?.name ?? exerciseId}`}
                          >
                            删除
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <div className="plan-exercise-list">
                    {day.warmup && day.warmup.length > 0 ? (
                      <div className="warmup-block">
                        <div className="warmup-title">热身激活</div>
                        <ul className="warmup-list">
                          {day.warmup.map((item) => (
                            <li key={item.name}>
                              <div className="warmup-copy">
                                <span className="warmup-name">{item.name}</span>
                                <span className="warmup-detail">{item.detail}</span>
                              </div>
                              {item.imageUrl ? (
                                <img className="warmup-image" src={withBase(item.imageUrl)} alt={`${item.name}示意图`} loading="lazy" />
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {day.exerciseIds.map((exerciseId) => {
                      const key = `${day.id}:${exerciseId}`;
                      return (
                        <PlanExercisePreviewCard
                          key={key}
                          day={day}
                          exerciseId={exerciseId}
                          isExpanded={expandedPlanExerciseIds.has(key)}
                          onToggle={() => togglePlanExercise(day.id, exerciseId)}
                        />
                      );
                    })}
                  </div>
                )}
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
                  {day.exerciseIds.length === 0 ? (
                    <span className="start-hint">先加动作才能开始</span>
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
              <span>
                加入：{plan.days.find((day) => day.id === pickerDayId)?.name ?? '未选择'}
                {' · 已选 '}
                {plan.days.find((day) => day.id === pickerDayId)?.exerciseIds.length ?? 0} 个
              </span>
            </div>
            <input
              value={addQuery}
              onChange={(event) => setAddQuery(event.target.value)}
              placeholder="搜索要加入的动作（可连续添加多个）"
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
            <button
              type="button"
              className="secondary-button full-width"
              onClick={() => {
                setAddQuery('');
                setAddFilter('全部');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              完成添加，回到训练日
            </button>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function PlanExercisePreviewCard({
  day,
  exerciseId,
  isExpanded,
  onToggle,
}: {
  day: TrainingDayTemplate;
  exerciseId: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const exercise = getExerciseById(exerciseId);
  const coachNote = findCoachNote(day, exerciseId);
  const exerciseName = exercise?.name ?? exerciseId;

  return (
    <article className={isExpanded ? 'plan-exercise-card active' : 'plan-exercise-card'}>
      <button
        type="button"
        className="exercise-heading"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={`${exerciseName} 展开收起`}
      >
        <div>
          <h3>{exerciseName}</h3>
          <p>{exercise?.muscleGroups.join(' / ')} · {exercise?.equipment}</p>
        </div>
        <span className="exercise-heading-meta">
          <span>0/5</span>
          <span className="exercise-chevron" aria-hidden="true">{isExpanded ? '▴' : '▾'}</span>
        </span>
      </button>

      {isExpanded ? (
        <div className="plan-exercise-body">
          {coachNote ? <CoachCueCard note={coachNote} /> : <p className="start-hint">暂无名师要点</p>}
        </div>
      ) : null}
    </article>
  );
}

function ExerciseLibrary({
  query,
  filter,
  sessions,
  onQueryChange,
  onFilterChange,
  onOpenExercise,
}: {
  query: string;
  filter: ExerciseFilter;
  sessions: WorkoutSession[];
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: ExerciseFilter) => void;
  onOpenExercise: (exerciseId: string) => void;
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
        {results.map((exercise) => {
          const summary = getExercisePerformanceSummary(sessions, exercise.id);
          const imageUrl = getExerciseImageUrl(exercise.id);
          return (
            <button
              type="button"
              className="exercise-profile-card"
              key={exercise.id}
              onClick={() => onOpenExercise(exercise.id)}
              aria-label={`打开${exercise.name}动作详情`}
            >
              {imageUrl ? (
                <img className="exercise-profile-thumb" src={withBase(imageUrl)} alt="" loading="lazy" />
              ) : (
                <span className="exercise-profile-thumb placeholder" aria-hidden="true">无图</span>
              )}
              <span className="exercise-profile-copy">
                <strong>{exercise.name}</strong>
                <small>{exercise.muscleGroups.join(' / ')} · {exercise.equipment}</small>
                <span className="exercise-record-tags">
                  {summary ? (
                    <>
                      <em>最近 {formatSetLabel(summary.latest.bestSet.weight, summary.latest.bestSet.reps)}</em>
                      <em className="best">最佳 {formatWeight(summary.bestWeight)} × {summary.bestReps}</em>
                    </>
                  ) : (
                    <em>暂无训练记录</em>
                  )}
                </span>
              </span>
              <span className="exercise-profile-arrow" aria-hidden="true">›</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function getRecommendedWorkout(
  sessions: WorkoutSession[],
  builtinPlans: CoachPlan[],
  customPlans: CoachPlan[],
  currentPlanId: string | null,
): RecommendedWorkout | null {
  if (!currentPlanId) {
    return null;
  }

  const currentPlan = [...builtinPlans, ...customPlans].find((plan) => plan.id === currentPlanId);
  const fallbackDay = currentPlan?.days[0];

  if (!currentPlan || !fallbackDay) {
    return null;
  }

  const latest = sessions
    .filter((session) => session.planId === currentPlan.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  if (!latest) {
    return {
      plan: currentPlan,
      day: fallbackDay,
      reason: `当前计划：${currentPlan.title}`,
    };
  }

  const currentIndex = currentPlan.days.findIndex((day) => day.id === latest.dayId);
  const recentDay = currentIndex >= 0 ? currentPlan.days[currentIndex] : undefined;
  const nextDay = currentIndex >= 0 ? currentPlan.days[(currentIndex + 1) % currentPlan.days.length] : fallbackDay;

  return {
    plan: currentPlan,
    day: nextDay,
    reason: recentDay ? `根据最近一次训练：上次完成 ${recentDay.name}` : '根据最近一次训练安排下一次',
  };
}

function splitDayTitle(dayName: string): { prefix: string; title: string } {
  const match = dayName.match(/^(Day\s+\d+)\s+(.+)$/);
  if (!match) {
    return { prefix: '', title: dayName };
  }
  return { prefix: match[1], title: match[2] };
}

function getPlanChoiceSummary(plan: CoachPlan): string {
  const daySummary = plan.days.map((day) => splitDayTitle(day.name).title).join(' / ');
  return `${plan.coachName} · ${plan.days.length} 天 · ${daySummary}`;
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
      title: selectedPlan?.title ?? '计划详情',
      subtitle: selectedPlan?.coachName ?? '名师计划',
    };
  }

  if (route.name === 'custom-library') {
    return { title: '我的计划', subtitle: '自定义训练库' };
  }

  if (route.name === 'custom-plan') {
    return {
      title: selectedPlan?.title.trim() || '自定义计划',
      subtitle: '动作库拼装 / 本地保存',
    };
  }

  if (route.name === 'exercise-detail') {
    const exercise = getExerciseById(route.exerciseId);
    return {
      title: exercise?.name ?? '动作详情',
      subtitle: exercise ? `${exercise.muscleGroups.join(' / ')} · ${exercise.equipment}` : '动作档案',
    };
  }

  if (activeTab === 'exercises') {
    return { title: '动作库', subtitle: '搜索动作、肌群和器械' };
  }

  if (activeTab === 'history') {
    return { title: '历史训练', subtitle: '查看过往训练日、动作和逐组数据' };
  }

  return { title: '力量日记', subtitle: getDailyTrainingQuote() };
}

export default App;
