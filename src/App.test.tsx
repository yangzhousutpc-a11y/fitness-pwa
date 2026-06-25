import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';

describe('fitness PWA user flows', () => {
  beforeEach(() => {
    localStorage.clear();
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

  it('starts a coach-plan workout, records a set, and saves it to history', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入名师计划' }));
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
    expect(JSON.parse(localStorage.getItem('fitness-pwa.sessions.v1') ?? '[]')).toHaveLength(1);
  });

  it('expands training days independently and keeps coach notes out of plan browsing', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入名师计划' }));

    // 默认展开 Day 1
    expect(screen.getByText('杠铃卧推')).toBeInTheDocument();
    expect(screen.queryByText('引体向上')).not.toBeInTheDocument();
    expect(screen.queryByText('名师要点')).not.toBeInTheDocument();
    expect(screen.queryByText('作为胸肩三头日的主力复合推举，先建立稳定卧推动作和胸部张力。')).not.toBeInTheDocument();

    // 展开 Day 2 —— Day 1 应仍保持展开（独立展开，非互斥）
    fireEvent.click(screen.getByRole('button', { name: 'Day 2 背 / 后束 / 二头' }));
    expect(screen.getByText('杠铃卧推')).toBeInTheDocument();
    expect(screen.getByText('引体向上')).toBeInTheDocument();
    expect(screen.queryByText('名师要点')).not.toBeInTheDocument();

    // 再点 Day 2 —— 收起 Day 2，Day 1 不受影响
    fireEvent.click(screen.getByRole('button', { name: 'Day 2 背 / 后束 / 二头' }));
    expect(screen.getByText('杠铃卧推')).toBeInTheDocument();
    expect(screen.queryByText('引体向上')).not.toBeInTheDocument();
  });

  it('starts workouts with five sets and supports adding and deleting sets per exercise', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入名师计划' }));
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

    fireEvent.click(screen.getByRole('button', { name: '进入名师计划' }));
    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));

    // 默认：第一个动作展开（有逐组输入），第二个折叠（无输入但有标题）
    expect(screen.getByLabelText('第 1 组重量')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '上斜哑铃卧推' })).toBeInTheDocument();
    expect(screen.getAllByLabelText('第 5 组重量')).toHaveLength(1);

    // 展开第二个动作 → 现在两个动作的逐组输入都在
    fireEvent.click(screen.getByRole('button', { name: '上斜哑铃卧推 展开收起' }));
    expect(screen.getAllByLabelText('第 5 组重量')).toHaveLength(2);
  });

  it('auto-fills the next set when the previous set is checked complete', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入名师计划' }));
    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));

    fireEvent.change(screen.getByLabelText('第 1 组重量'), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText('第 1 组次数'), { target: { value: '10' } });
    fireEvent.click(screen.getByLabelText('切换第 1 组完成状态'));

    // 勾完第 1 组 → 第 2 组重量/次数自动带入（此前为空）
    expect((screen.getByLabelText('第 2 组重量') as HTMLInputElement).value).toBe('60');
    expect((screen.getByLabelText('第 2 组次数') as HTMLInputElement).value).toBe('10');
  });

  it('steps weight by 2.5 and reps by 1 via plus buttons', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入名师计划' }));
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

    fireEvent.click(screen.getByRole('button', { name: '进入名师计划' }));
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

    fireEvent.click(screen.getByRole('button', { name: '进入名师计划' }));
    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));

    expect(screen.queryByRole('timer')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByLabelText('切换第 1 组完成状态')[0]);

    expect(screen.getByRole('timer', { name: '组间休息计时器' })).toBeInTheDocument();
    expect(screen.getByText('01:30')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '关闭休息计时器' }));
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });

  it('shows personal records and weekly overview in history after a workout', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入名师计划' }));
    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));
    fireEvent.change(screen.getAllByLabelText('第 1 组重量')[0], { target: { value: '60' } });
    fireEvent.change(screen.getAllByLabelText('第 1 组次数')[0], { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: '完成' }));

    expect(screen.getByText('本周概览')).toBeInTheDocument();
    expect(screen.getByText('个人最好成绩')).toBeInTheDocument();
    expect(screen.getByText('动作进度')).toBeInTheDocument();
    // 杠铃卧推 60kg 应作为 PR 出现
    expect(screen.getByText('60')).toBeInTheDocument();
  });

  it('shows coach note screenshots instead of generated diagrams', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入名师计划' }));
    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));
    const firstCoachNote = screen.getAllByText('名师要点')[0].closest('.coach-cue-card');

    expect(firstCoachNote).not.toBeNull();
    expect(within(firstCoachNote as HTMLElement).getByRole('img')).toHaveAttribute('src', '/coach-shots/bench.jpg');
  });

  it('home shows two separate entries: builtin coach plan and custom library', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: '进入名师计划' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '进入我的计划' })).toBeInTheDocument();

    // 进入我的计划库
    fireEvent.click(screen.getByRole('button', { name: '进入我的计划' }));
    expect(screen.getByRole('button', { name: '+ 新建自定义计划' })).toBeInTheDocument();
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

    // 返回应回到我的计划库（而非首页双入口）
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    expect(screen.getByRole('button', { name: '+ 新建自定义计划' })).toBeInTheDocument();
    // 未命名计划在列表卡兜底显示
    expect(screen.getByText('未命名计划')).toBeInTheDocument();
  });

  it('gives each exercise its own coach screenshot (no shared image within a day)', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '进入名师计划' }));
    // 先收起默认展开的 Day 1，再单独展开 Day 2（含 引体向上 / 高位下拉，曾共用 pull.jpg）
    fireEvent.click(screen.getByRole('button', { name: 'Day 1 胸 / 肩 / 三头' }));
    fireEvent.click(screen.getByRole('button', { name: 'Day 2 背 / 后束 / 二头' }));
    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));

    // 训练页默认只展开第一个动作；单独展开「高位下拉」「坐姿划船」（曾各自与 引体/划船 共用图）
    fireEvent.click(screen.getByRole('button', { name: '高位下拉 展开收起' }));
    fireEvent.click(screen.getByRole('button', { name: '坐姿绳索划船 展开收起' }));

    const imgs = screen.getAllByRole('img') as HTMLImageElement[];
    const srcs = imgs.map((img) => img.getAttribute('src'));
    expect(srcs).toContain('/coach-shots/lat-pulldown.jpg');
    expect(srcs).toContain('/coach-shots/seated-cable-row.jpg');
    // 这两张与默认展开的引体向上(pull.jpg)互不重复
    expect(new Set(srcs).size).toBe(srcs.length);
  });

  it('shows weekly overview and personal records on the plan home after a workout', () => {
    render(<App />);

    // 无记录时首页不显示概览/PR
    expect(screen.queryByText('本周概览')).not.toBeInTheDocument();
    expect(screen.queryByText('个人最好成绩')).not.toBeInTheDocument();

    // 完成一次训练
    fireEvent.click(screen.getByRole('button', { name: '进入名师计划' }));
    fireEvent.click(screen.getByRole('button', { name: '开始训练' }));
    fireEvent.change(screen.getByLabelText('第 1 组重量'), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText('第 1 组次数'), { target: { value: '10' } });
    fireEvent.click(screen.getByLabelText('切换第 1 组完成状态'));
    fireEvent.click(screen.getByRole('button', { name: '完成' }));

    // 回到计划首页（顶部「计划」Tab）
    fireEvent.click(screen.getByRole('button', { name: /计划/ }));

    // 首页现在应同时出现 本周概览 + 个人最好成绩 + 双入口
    expect(screen.getByRole('button', { name: '进入名师计划' })).toBeInTheDocument();
    expect(screen.getByText('本周概览')).toBeInTheDocument();
    expect(screen.getByText('个人最好成绩')).toBeInTheDocument();
    expect(screen.getByText('杠铃卧推')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
  });
});
