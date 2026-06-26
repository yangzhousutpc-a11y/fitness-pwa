import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const apiState = vi.hoisted(() => ({
  currentPlanId: null as string | null,
  customPlans: [] as any[],
  loadError: null as Error | null,
  sessions: [] as any[],
}));

vi.mock('./api', () => ({
  getCustomPlans: vi.fn(async () => {
    if (apiState.loadError) {
      const error = apiState.loadError;
      apiState.loadError = null;
      throw error;
    }
    return apiState.customPlans;
  }),
  getCurrentPlanPreference: vi.fn(async () => ({ planId: apiState.currentPlanId })),
  saveCurrentPlanPreference: vi.fn(async (planId: string) => {
    apiState.currentPlanId = planId;
    return { planId };
  }),
  getWorkoutSessions: vi.fn(async () => apiState.sessions),
  saveCustomPlan: vi.fn(async (plan: any) => {
    apiState.customPlans = [plan, ...apiState.customPlans.filter((item: any) => item.id !== plan.id)];
    return plan;
  }),
  deleteCustomPlan: vi.fn(async (planId: string) => {
    apiState.customPlans = apiState.customPlans.filter((item: any) => item.id !== planId);
    return { id: planId };
  }),
  saveWorkoutSession: vi.fn(async (session: any) => {
    apiState.sessions = [session, ...apiState.sessions.filter((item: any) => item.id !== session.id)];
    return session;
  }),
  deleteWorkoutSession: vi.fn(async (sessionId: string) => {
    apiState.sessions = apiState.sessions.filter((item: any) => item.id !== sessionId);
    return { id: sessionId };
  }),
}));

describe('fitness PWA user flows', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    apiState.currentPlanId = null;
    apiState.customPlans = [];
    apiState.loadError = null;
    apiState.sessions = [];
    localStorage.clear();
    sessionStorage.clear();
  });

  it('lets the user save an access key and retry database loading', async () => {
    apiState.loadError = new Error('访问密钥无效，请重新输入');

    render(<App />);

    expect(await screen.findByText('访问密钥无效，请重新输入')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('访问密钥'), { target: { value: 'phone-secret' } });
    fireEvent.click(screen.getByRole('button', { name: '保存并重试' }));

    await waitFor(() => {
      expect(localStorage.getItem('fitness-pwa.api-token.v1')).toBe('phone-secret');
      expect(screen.getByRole('button', { name: '进入三分化训练计划' })).toBeInTheDocument();
    });
  });

  it('filters the exercise library by selected muscle group and search query', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '◉动作库' }));
    fireEvent.click(screen.getByRole('button', { name: '胸' }));

    expect(screen.getByText('杠铃卧推')).toBeInTheDocument();
    expect(screen.queryByText('杠铃深蹲')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('⌕ 搜索动作'), { target: { value: '飞鸟' } });

    expect(screen.getByText('哑铃飞鸟')).toBeInTheDocument();
    expect(screen.queryByText('杠铃卧推')).not.toBeInTheDocument();
  });

  it('opens an exercise profile with personal records from workout history', async () => {
    apiState.sessions = [
      {
        id: 'session-bench',
        date: '2026-06-26T08:00:00.000Z',
        planId: 'split-3-day',
        dayId: 'day-1',
        exerciseLogs: [
          {
            exerciseId: 'barbell-bench-press',
            note: '',
            sets: [
              { setNumber: 1, weight: 60, reps: 10, completed: true },
              { setNumber: 2, weight: 65, reps: 8, completed: true },
            ],
          },
        ],
      },
    ];

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '◉动作库' }));
    expect(await screen.findByText('最近 65kg × 8')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '打开杠铃卧推动作详情' }));

    expect(screen.getByRole('heading', { name: '杠铃卧推', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('我的表现')).toBeInTheDocument();
    expect(screen.getByText('65kg')).toBeInTheDocument();
    expect(screen.getByText('10次')).toBeInTheDocument();
    expect(screen.getAllByText('1,120kg').length).toBeGreaterThan(0);
    expect(screen.getByText('最近 5 次')).toBeInTheDocument();
  });

  it('uses action-specific generated images instead of a generic placeholder', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '◉动作库' }));
    fireEvent.change(screen.getByPlaceholderText('⌕ 搜索动作'), { target: { value: '俯卧撑' } });
    fireEvent.click(await screen.findByRole('button', { name: '打开俯卧撑动作详情' }));

    const image = screen.getByAltText('俯卧撑动作插图') as HTMLImageElement;
    expect(image.src).toContain('/coach-shots/push-up-cue.jpg');
    expect(image.src).not.toContain('action-profile-hero');
  });


  it('shows a daily fitness quote on the plan home header', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-26T08:00:00+08:00'));

    render(<App />);
    await vi.runAllTimersAsync();

    expect(screen.getByRole('heading', { name: '力量日记', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('少一点犹豫，多完成一组')).toBeInTheDocument();
  });

  it('starts a coach-plan workout, records a set, and saves it to history', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入三分化训练计划' }));
    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));

    expect(screen.getByText('杠铃卧推')).toBeInTheDocument();
    expect(screen.getAllByText('名师要点').length).toBeGreaterThan(0);

    fireEvent.change(screen.getAllByLabelText('第 1 组重量')[0], { target: { value: '60' } });
    fireEvent.change(screen.getAllByLabelText('第 1 组次数')[0], { target: { value: '10' } });
    fireEvent.click(screen.getAllByLabelText('切换第 1 组完成状态')[0]);

    expect(screen.getByText('1/25 组完成')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '完成' }));

    expect(screen.getByText('训练记录')).toBeInTheDocument();
    expect(screen.getByText('5 个动作 · 1/25 组完成')).toBeInTheDocument();
    expect(apiState.sessions).toHaveLength(1);
  });

  it('expands training days independently and lets plan exercises fold open like workout cards', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入三分化训练计划' }));

    // 默认展开 Day 1
    expect(screen.getByText('杠铃卧推')).toBeInTheDocument();
    expect(screen.queryByText('引体向上')).not.toBeInTheDocument();
    expect(screen.getByText('名师要点')).toBeInTheDocument();
    expect(screen.getByText('作为胸肩三头日的主力复合推举，先建立稳定卧推动作和胸部张力。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '杠铃卧推 展开收起' }));
    expect(screen.queryByText('作为胸肩三头日的主力复合推举，先建立稳定卧推动作和胸部张力。')).not.toBeInTheDocument();

    // 展开 Day 2 —— Day 1 应仍保持展开（独立展开，非互斥）
    fireEvent.click(screen.getByRole('button', { name: 'Day 2 背 / 后束 / 二头' }));
    expect(screen.getByText('杠铃卧推')).toBeInTheDocument();
    expect(screen.getByText('引体向上')).toBeInTheDocument();

    // 再点 Day 2 —— 收起 Day 2，Day 1 不受影响
    fireEvent.click(screen.getByRole('button', { name: 'Day 2 背 / 后束 / 二头' }));
    expect(screen.getByText('杠铃卧推')).toBeInTheDocument();
    expect(screen.queryByText('引体向上')).not.toBeInTheDocument();
  });

  it('keeps plan exercise collapse on the sticky heading instead of adding a bottom action', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入三分化训练计划' }));

    expect(screen.getByText('作为胸肩三头日的主力复合推举，先建立稳定卧推动作和胸部张力。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '收起杠铃卧推' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '杠铃卧推 展开收起' }));

    expect(screen.queryByText('作为胸肩三头日的主力复合推举，先建立稳定卧推动作和胸部张力。')).not.toBeInTheDocument();
  });

  it('starts workouts with five sets and supports adding and deleting sets per exercise', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入三分化训练计划' }));
    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));

    // 进入训练默认只展开第一个动作（杠铃卧推），故只有它的 5 组可见
    expect(screen.getByText('0/25 组完成')).toBeInTheDocument();
    expect(screen.getAllByLabelText('第 5 组重量')).toHaveLength(1);

    fireEvent.click(screen.getByLabelText('给杠铃卧推增加一组'));

    expect(screen.getByText('0/26 组完成')).toBeInTheDocument();
    expect(screen.getByLabelText('第 6 组重量')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('删除杠铃卧推最后一组'));

    expect(screen.getByText('0/25 组完成')).toBeInTheDocument();
    expect(screen.queryByLabelText('第 6 组重量')).not.toBeInTheDocument();
  });

  it('expands the first exercise by default and lets each be toggled independently', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入三分化训练计划' }));
    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));

    // 默认：第一个动作展开（有逐组输入），第二个折叠（无输入但有标题）
    expect(screen.getByLabelText('第 1 组重量')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '上斜哑铃卧推' })).toBeInTheDocument();
    expect(screen.getAllByLabelText('第 5 组重量')).toHaveLength(1);

    // 展开第二个动作 → 现在两个动作的逐组输入都在
    fireEvent.click(screen.getByRole('button', { name: '上斜哑铃卧推 展开收起' }));
    expect(screen.getAllByLabelText('第 5 组重量')).toHaveLength(2);
  });

  it('keeps workout exercise collapse on the sticky heading instead of adding a bottom action', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入三分化训练计划' }));
    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));

    expect(screen.getByLabelText('第 1 组重量')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '收起杠铃卧推' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '杠铃卧推 展开收起' }));

    expect(screen.queryByLabelText('第 1 组重量')).not.toBeInTheDocument();
  });

  it('auto-fills the next set when the previous set is checked complete', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入三分化训练计划' }));
    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));

    fireEvent.change(screen.getByLabelText('第 1 组重量'), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText('第 1 组次数'), { target: { value: '10' } });
    fireEvent.click(screen.getByLabelText('切换第 1 组完成状态'));

    // 勾完第 1 组 → 第 2 组重量/次数自动带入（此前为空）
    expect((screen.getByLabelText('第 2 组重量') as HTMLInputElement).value).toBe('60');
    expect((screen.getByLabelText('第 2 组次数') as HTMLInputElement).value).toBe('10');
    expect(screen.getByLabelText('第 1 组重量').closest('.set-row')).toHaveClass('completed');
    expect(screen.getByLabelText('第 2 组重量').closest('.set-row')).toHaveClass('active');
    expect(screen.getByText('休息后录 杠铃卧推 · 第 2 组')).toBeInTheDocument();
  });

  it('moves the active target to the next exercise after the last set is completed', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入三分化训练计划' }));
    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));

    for (const setNumber of [1, 2, 3, 4, 5]) {
      fireEvent.click(screen.getByLabelText(`切换第 ${setNumber} 组完成状态`));
    }

    expect(screen.getByText('休息后录 上斜哑铃卧推 · 第 1 组')).toBeInTheDocument();
    expect(screen.getAllByLabelText('第 1 组重量')).toHaveLength(2);
    expect(screen.getAllByLabelText('第 1 组重量')[1].closest('.set-row')).toHaveClass('active');
  });

  it('uses compact workout input mode while editing set numbers', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入三分化训练计划' }));
    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));

    const shell = screen.getByRole('main');
    const weightInput = screen.getByLabelText('第 1 组重量');

    expect(shell).not.toHaveClass('input-focus-mode');

    fireEvent.focus(weightInput);
    expect(shell).toHaveClass('input-focus-mode');

    fireEvent.blur(weightInput);
    expect(shell).not.toHaveClass('input-focus-mode');
  });

  it('steps weight by 2.5 and reps by 1 via plus buttons', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入三分化训练计划' }));
    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));

    fireEvent.change(screen.getByLabelText('第 1 组重量'), { target: { value: '60' } });
    fireEvent.click(screen.getByLabelText('第 1 组重量加 2.5'));
    expect((screen.getByLabelText('第 1 组重量') as HTMLInputElement).value).toBe('62.5');

    fireEvent.change(screen.getByLabelText('第 1 组次数'), { target: { value: '10' } });
    fireEvent.click(screen.getByLabelText('第 1 组次数加 1'));
    expect((screen.getByLabelText('第 1 组次数') as HTMLInputElement).value).toBe('11');
  });

  it('adds exercises from the library to the current workout only', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入三分化训练计划' }));
    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));
    fireEvent.click(screen.getByRole('button', { name: '添加动作' }));

    // 名师计划自带的杠铃卧推，按钮应明确为「本计划已含」且禁用（区别于"被自定义占用"）
    fireEvent.change(screen.getByPlaceholderText('搜索要加入的动作'), { target: { value: '卧推' } });
    const benchBtn = screen.getByRole('button', { name: '杠铃卧推本次训练已包含' });
    expect(benchBtn).toBeDisabled();
    expect(benchBtn).toHaveTextContent('本计划已含');

    fireEvent.change(screen.getByPlaceholderText('搜索要加入的动作'), { target: { value: '飞鸟' } });
    fireEvent.click(screen.getByLabelText('将哑铃飞鸟加入训练'));

    expect(screen.getByRole('heading', { name: '哑铃飞鸟' })).toBeInTheDocument();
    expect(screen.getByText('0/30 组完成')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '完成' }));

    expect(screen.getByText('6 个动作 · 0/30 组完成')).toBeInTheDocument();
  });

  it('starts a rest timer when a set is checked complete', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入三分化训练计划' }));
    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));

    expect(screen.queryByRole('timer')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByLabelText('切换第 1 组完成状态')[0]);

    expect(screen.getByRole('timer', { name: '组间休息计时器' })).toBeInTheDocument();
    expect(screen.getByText('01:30')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '关闭休息计时器' }));
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });

  it('shows personal records and weekly recap in history after a workout', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入三分化训练计划' }));
    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));
    fireEvent.change(screen.getAllByLabelText('第 1 组重量')[0], { target: { value: '60' } });
    fireEvent.change(screen.getAllByLabelText('第 1 组次数')[0], { target: { value: '10' } });
    fireEvent.click(screen.getAllByLabelText('切换第 1 组完成状态')[0]);
    fireEvent.click(screen.getByRole('button', { name: '完成' }));

    expect(screen.getByText('本周复盘')).toBeInTheDocument();
    expect(screen.getByText('个人最好成绩')).toBeInTheDocument();
    expect(screen.getByText('动作进度')).toBeInTheDocument();
    // 杠铃卧推 60kg 应作为 PR 出现
    expect(screen.getByText('60')).toBeInTheDocument();
  });

  it('deletes a workout session from history after confirmation', async () => {
    apiState.sessions = [
      {
        id: 'session-1',
        date: '2026-06-26T08:00:00.000Z',
        planId: 'kaishengwang-tanchengyi-three-day-split',
        dayId: 'day-1-push',
        exerciseLogs: [
          {
            exerciseId: 'barbell-bench-press',
            note: '',
            sets: [{ setNumber: 1, weight: 60, reps: 10, completed: true }],
          },
        ],
      },
    ];

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /历史/ }));

    expect(await screen.findByText('训练记录')).toBeInTheDocument();
    expect(screen.getByText('Day 1 胸 / 肩 / 三头')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '删除Day 1 胸 / 肩 / 三头训练记录' }));
    fireEvent.click(screen.getByRole('button', { name: '确认删除Day 1 胸 / 肩 / 三头训练记录' }));

    await waitFor(() => {
      expect(apiState.sessions).toHaveLength(0);
      expect(screen.getByText('还没有训练记录。进入计划并完成一次训练后会自动保存。')).toBeInTheDocument();
    });
  });

  it('shows the training calendar even when there is no history yet', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /历史/ }));

    expect(screen.getByText('训练日历')).toBeInTheDocument();
    expect(screen.getByText('当天没有训练记录')).toBeInTheDocument();
    expect(screen.getByText('还没有训练记录。进入计划并完成一次训练后会自动保存。')).toBeInTheDocument();
  });

  it('shows a monthly training calendar with day detail and next workout suggestion', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-06-26T12:00:00+08:00'));
    apiState.sessions = [
        {
          id: 's2',
          date: '2026-06-24T10:00:00+08:00',
          planId: 'kaishengwang-tanchengyi-three-day-split',
          dayId: 'day-1-push',
          exerciseLogs: [
            {
              exerciseId: 'barbell-bench-press',
              note: '',
              sets: [
                { setNumber: 1, weight: 60, reps: 10, completed: true },
                { setNumber: 2, weight: 62.5, reps: 8, completed: false },
              ],
            },
          ],
        },
        {
          id: 's1',
          date: '2026-06-20T10:00:00+08:00',
          planId: 'kaishengwang-tanchengyi-three-day-split',
          dayId: 'day-3-legs',
          exerciseLogs: [
            {
              exerciseId: 'squat',
              note: '',
              sets: [{ setNumber: 1, weight: 80, reps: 8, completed: true }],
            },
          ],
        },
      ];

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /历史/ }));

    expect(screen.getByText('训练日历')).toBeInTheDocument();
    expect(await screen.findByText('建议下一次练 Day 2 背 / 后束 / 二头')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '06月24日 有训练 Day 1' }));

    const selectedDayDetail = screen.getByRole('region', { name: '所选日期训练摘要' });
    expect(within(selectedDayDetail).getByText('训练：Day 1 胸 / 肩 / 三头')).toBeInTheDocument();
    expect(within(selectedDayDetail).getByText('完成 1/2 组 · 1 个动作')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '06月25日 无训练' }));

    expect(within(selectedDayDetail).getByText('当天没有训练记录')).toBeInTheDocument();
  });

  it('shows coach note cue illustrations based on exercise form', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入三分化训练计划' }));
    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));
    const firstCoachNote = screen.getAllByText('名师要点')[0].closest('.coach-cue-card');

    expect(firstCoachNote).not.toBeNull();
    expect(within(firstCoachNote as HTMLElement).getByRole('img')).toHaveAttribute('src', '/coach-shots/bench-cue.jpg');
  });

  it('home shows two separate entries: builtin coach plan and custom library', () => {
    render(<App />);

    expect(screen.getByText('选择训练计划')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '进入三分化训练计划' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '进入谭成义私教跟练' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '进入我的计划' })).toBeInTheDocument();

    // 进入我的计划库
    fireEvent.click(screen.getByRole('button', { name: '进入我的计划' }));
    expect(screen.getByRole('button', { name: '+ 新建自定义计划' })).toBeInTheDocument();
  });

  it('recommends the next workout while keeping the full plan entry available', async () => {
    apiState.currentPlanId = 'kaishengwang-tanchengyi-three-day-split';
    apiState.sessions = [
      {
        id: 'session-1',
        date: '2026-06-26T08:00:00.000Z',
        planId: 'kaishengwang-tanchengyi-three-day-split',
        dayId: 'day-1-push',
        exerciseLogs: [
          {
            exerciseId: 'barbell-bench-press',
            note: '',
            sets: [{ setNumber: 1, weight: 60, reps: 10, completed: true }],
          },
        ],
      },
    ];

    render(<App />);

    expect(await screen.findByText('下一次训练')).toBeInTheDocument();
    expect(screen.getByText('Day 2')).toBeInTheDocument();
    expect(screen.getByText('背 / 后束 / 二头')).toBeInTheDocument();
    expect(screen.getByText('根据最近一次训练：上次完成 Day 1 胸 / 肩 / 三头')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '进入三分化训练计划' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '开始推荐训练' }));

    expect(screen.getByRole('heading', { name: '引体向上' })).toBeInTheDocument();
    expect(screen.getByText('0/30 组完成')).toBeInTheDocument();
  });

  it('requires a current follow plan before recommending and keeps recommendations inside that plan', async () => {
    apiState.sessions = [
      {
        id: 'session-1',
        date: '2026-06-26T08:00:00.000Z',
        planId: 'kaishengwang-tanchengyi-three-day-split',
        dayId: 'day-1-push',
        exerciseLogs: [
          {
            exerciseId: 'barbell-bench-press',
            note: '',
            sets: [{ setNumber: 1, weight: 60, reps: 10, completed: true }],
          },
        ],
      },
    ];

    render(<App />);

    expect(await screen.findByText('选择当前跟练计划')).toBeInTheDocument();
    expect(screen.getByText('先在下方选择一个名师计划设为当前跟练')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '设为当前跟练谭成义私教跟练' }));

    await waitFor(() => {
      expect(apiState.currentPlanId).toBe('tanchengyi-private-coaching-follow-along');
      expect(screen.getByText('当前计划：谭成义私教跟练')).toBeInTheDocument();
      expect(screen.getByText('Day 1')).toBeInTheDocument();
      expect(screen.getByText('背部')).toBeInTheDocument();
      expect(screen.queryByText('背 / 后束 / 二头')).not.toBeInTheDocument();
    });

    const splitPlanCard = screen.getByRole('button', { name: '进入三分化训练计划' }).closest('.plan-choice-card');
    const privatePlanCard = screen.getByRole('button', { name: '进入谭成义私教跟练' }).closest('.plan-choice-card');

    expect(splitPlanCard).not.toHaveClass('primary');
    expect(privatePlanCard).toHaveClass('primary');
    expect(screen.queryByText('三分化完整计划')).not.toBeInTheDocument();
    expect(screen.queryByText('Day 1 / Day 2 / Day 3 全部训练内容')).not.toBeInTheDocument();
  });

  it('opens the Tan Chengyi private coaching plan and starts a workout from it', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入谭成义私教跟练' }));

    expect(screen.getByRole('heading', { name: '谭成义私教跟练', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Day 1 背部')).toBeInTheDocument();
    expect(screen.getByText('Day 2 手臂')).toBeInTheDocument();
    expect(screen.getByText('Day 3 胸部')).toBeInTheDocument();
    expect(screen.getByText('Day 4 肩部')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '视频' })).toHaveAttribute('href', 'https://www.bilibili.com/video/BV1HR7o6CE8q/');

    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));

    expect(screen.getByText('高位下拉')).toBeInTheDocument();
    expect(screen.getByText('0/30 组完成')).toBeInTheDocument();
  });

  it('keeps bottom navigation height on detail, custom editor, and workout pages', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入三分化训练计划' }));
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /返回/ }));
    fireEvent.click(screen.getByRole('button', { name: '进入我的计划' }));
    fireEvent.click(screen.getByRole('button', { name: '+ 新建自定义计划' }));
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('搜索要加入的动作（可连续添加多个）'), {
      target: { value: '卧推' },
    });
    fireEvent.click(screen.getByLabelText('将杠铃卧推加入当前计划'));
    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /历史/ }));
    expect(screen.getByText('0/5 组完成')).toBeInTheDocument();
  });

  it('creates a custom plan from the library and returns to the library', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入我的计划' }));
    fireEvent.click(screen.getByRole('button', { name: '+ 新建自定义计划' }));

    // 进入自定义计划编辑器：标题为空(有 placeholder)，不应出现名师专属的视频链接
    const titleInput = screen.getByLabelText('计划标题') as HTMLInputElement;
    expect(titleInput).toBeInTheDocument();
    expect(titleInput.value).toBe('');
    expect(titleInput).toHaveAttribute('placeholder', '给计划起个名字');
    expect(screen.queryByText('打开原视频合集')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '视频' })).not.toBeInTheDocument();
    expect(screen.queryByText('自定义')).not.toBeInTheDocument(); // eyebrow 不再硬塞「自定义」

    // 给计划起个名字后再返回，计划应保留在库里
    fireEvent.change(titleInput, { target: { value: '我的推日' } });
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    expect(screen.getByRole('button', { name: '+ 新建自定义计划' })).toBeInTheDocument();
    expect(screen.getByText('我的推日')).toBeInTheDocument();
  });

  it('treats a custom plan as one exercise list instead of multiple training days', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入我的计划' }));
    fireEvent.click(screen.getByRole('button', { name: '+ 新建自定义计划' }));

    expect(screen.queryByRole('button', { name: 'Day 1' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新增训练日' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '删除训练日' })).not.toBeInTheDocument();
    expect(screen.getByText('还没有动作，先从动作库添加。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始训练' })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('搜索要加入的动作（可连续添加多个）'), {
      target: { value: '卧推' },
    });
    fireEvent.click(screen.getByLabelText('将杠铃卧推加入当前计划'));

    expect(screen.getByRole('button', { name: '从当前计划删除杠铃卧推' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始训练' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));
    expect(screen.getByText('0/5 组完成')).toBeInTheDocument();
  });

  it('opens old multi-day custom plans as a single combined exercise list', async () => {
    apiState.customPlans = [
        {
          id: 'legacy-custom',
          coachName: '自定义',
          title: '旧计划',
          description: '',
          sourceUrl: '',
          planType: 'custom',
          days: [
            {
              id: 'legacy-day-1',
              name: 'Day 1',
              focus: ['胸'],
              sourceUrl: '',
              exerciseIds: ['barbell-bench-press'],
              coachNotes: [],
            },
            {
              id: 'legacy-day-2',
              name: 'Day 2',
              focus: ['腿'],
              sourceUrl: '',
              exerciseIds: ['squat'],
              coachNotes: [],
            },
          ],
        },
      ];

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入我的计划' }));
    expect(await screen.findByText('旧计划')).toBeInTheDocument();
    expect(screen.getByText('2 个动作')).toBeInTheDocument();
    expect(screen.queryByText(/训练日/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '编辑' }));

    expect(screen.queryByRole('button', { name: 'Day 1' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新增训练日' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '从当前计划删除杠铃卧推' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '从当前计划删除杠铃深蹲' })).toBeInTheDocument();
  });

  it('discards an empty custom plan when leaving the editor without any input', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入我的计划' }));
    fireEvent.click(screen.getByRole('button', { name: '+ 新建自定义计划' }));
    // 什么都不填直接返回 → 空计划应被自动丢弃，库里仍为空
    fireEvent.click(screen.getByRole('button', { name: '返回' }));

    expect(screen.getByRole('button', { name: '+ 新建自定义计划' })).toBeInTheDocument();
    expect(screen.queryByText('未命名计划')).not.toBeInTheDocument();
    expect(screen.getByText('还没有自定义计划')).toBeInTheDocument();
  });

  it('requires a second tap to confirm deleting a custom plan', () => {
    render(<App />);

    // 先建一个有名字的计划
    fireEvent.click(screen.getByRole('button', { name: '进入我的计划' }));
    fireEvent.click(screen.getByRole('button', { name: '+ 新建自定义计划' }));
    fireEvent.change(screen.getByLabelText('计划标题'), { target: { value: '待删计划' } });
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    expect(screen.getByText('待删计划')).toBeInTheDocument();

    // 第一次点删除 → 只是进入"确认删除？"态，计划还在
    fireEvent.click(screen.getByRole('button', { name: '删除待删计划' }));
    expect(screen.getByRole('button', { name: '确认删除待删计划' })).toBeInTheDocument();
    expect(screen.getByText('待删计划')).toBeInTheDocument();

    // 第二次点确认 → 真删
    fireEvent.click(screen.getByRole('button', { name: '确认删除待删计划' }));
    expect(screen.queryByText('待删计划')).not.toBeInTheDocument();
    expect(screen.getByText('还没有自定义计划')).toBeInTheDocument();
  });

  it('gives each exercise its own coach cue image within a day', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入三分化训练计划' }));
    // 先收起默认展开的 Day 1，再单独展开 Day 2（含 引体向上 / 高位下拉，曾共用 pull 图）
    fireEvent.click(screen.getByRole('button', { name: 'Day 1 胸 / 肩 / 三头' }));
    fireEvent.click(screen.getByRole('button', { name: 'Day 2 背 / 后束 / 二头' }));
    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));

    // 训练页默认只展开第一个动作；单独展开「高位下拉」「坐姿划船」（曾各自与 引体/划船 共用图）
    fireEvent.click(screen.getByRole('button', { name: '高位下拉 展开收起' }));
    fireEvent.click(screen.getByRole('button', { name: '坐姿绳索划船 展开收起' }));

    const imgs = screen.getAllByRole('img') as HTMLImageElement[];
    const srcs = imgs.map((img) => img.getAttribute('src'));
    expect(srcs).toContain('/coach-shots/lat-pulldown-cue.jpg');
    expect(srcs).toContain('/coach-shots/seated-cable-row-cue.jpg');
    // 这两张与默认展开的引体向上互不重复
    expect(new Set(srcs).size).toBe(srcs.length);
  });

  it('shows weekly overview and personal records on the plan home after a workout', () => {
    render(<App />);

    // 无记录时首页不显示概览/PR
    expect(screen.queryByText('本周概览')).not.toBeInTheDocument();
    expect(screen.queryByText('个人最好成绩')).not.toBeInTheDocument();

    // 完成一次训练
    fireEvent.click(screen.getByRole('button', { name: '进入三分化训练计划' }));
    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));
    fireEvent.change(screen.getByLabelText('第 1 组重量'), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText('第 1 组次数'), { target: { value: '10' } });
    fireEvent.click(screen.getByLabelText('切换第 1 组完成状态'));
    fireEvent.click(screen.getByRole('button', { name: '完成' }));

    // 回到计划首页（顶部「计划」Tab）
    fireEvent.click(screen.getByRole('button', { name: /计划/ }));

    // 首页现在应同时出现 本周概览 + 个人最好成绩 + 双入口
    expect(screen.getByRole('button', { name: '进入三分化训练计划' })).toBeInTheDocument();
    expect(screen.getByText('本周概览')).toBeInTheDocument();
    expect(screen.getByText('个人最好成绩')).toBeInTheDocument();
    expect(screen.getByText('杠铃卧推')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
  });
});
