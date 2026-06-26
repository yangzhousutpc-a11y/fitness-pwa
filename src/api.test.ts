import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoachPlan, WorkoutSession } from './types';

const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

describe('database API client', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    sessionStorage.clear();
    sessionStorage.setItem('fitness-pwa.api-token.v1', 'secret-token');
  });

  it('does not block local preview with an access-key prompt when no token is saved', async () => {
    const promptMock = vi.fn();
    vi.stubGlobal('prompt', promptMock);
    sessionStorage.clear();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: 0, data: [] }),
    });
    const { getCustomPlans } = await import('./api');

    await expect(getCustomPlans()).resolves.toEqual([]);

    expect(promptMock).not.toHaveBeenCalled();
  });

  it('loads custom plans with the bearer token and unwraps the API response', async () => {
    const plan: CoachPlan = {
      id: 'custom-plan-1',
      coachName: '自定义',
      title: '推日',
      description: '',
      sourceUrl: '',
      planType: 'custom',
      days: [
        {
          id: 'custom-day-1',
          name: '自定义训练',
          focus: ['胸'],
          sourceUrl: '',
          exerciseIds: ['barbell-bench-press'],
          coachNotes: [],
        },
      ],
    };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: 0, data: [plan] }),
    });
    const { getCustomPlans } = await import('./api');

    await expect(getCustomPlans()).resolves.toEqual([plan]);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/custom-plans',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer secret-token' }),
      }),
    );
  });

  it('saves workout sessions through the API without using localStorage', async () => {
    const session: WorkoutSession = {
      id: 'session-1',
      date: '2026-06-26T08:00:00.000Z',
      planId: 'kaishengwang-tanchengyi-three-day-split',
      dayId: 'day-1-push',
      exerciseLogs: [
        {
          exerciseId: 'barbell-bench-press',
          note: '状态好',
          sets: [{ setNumber: 1, weight: 60, reps: 10, completed: true }],
        },
      ],
    };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: 0, data: session }),
    });
    const { saveWorkoutSession } = await import('./api');

    await expect(saveWorkoutSession(session)).resolves.toEqual(session);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/workout-sessions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(session),
      }),
    );
    expect(localStorage.getItem('fitness-pwa.sessions.v1')).toBeNull();
  });

  it('clears the saved token when the API returns 401', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ code: 1, message: 'Unauthorized' }),
    });
    const { getWorkoutSessions } = await import('./api');

    await expect(getWorkoutSessions()).rejects.toThrow('访问密钥无效，请重新输入');

    expect(sessionStorage.getItem('fitness-pwa.api-token.v1')).toBeNull();
  });
});
