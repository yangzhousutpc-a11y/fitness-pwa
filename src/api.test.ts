import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoachPlan, WorkoutSession } from './types';

const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

describe('database API client', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('fitness-pwa.api-token.v1', 'secret-token');
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
      '/api/custom-plans',
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
      '/api/workout-sessions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(session),
      }),
    );
    expect(localStorage.getItem('fitness-pwa.sessions.v1')).toBeNull();
  });

  it('deletes workout sessions through the API', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: 0, data: { id: 'session-1' } }),
    });
    const { deleteWorkoutSession } = await import('./api');

    await expect(deleteWorkoutSession('session-1')).resolves.toEqual({ id: 'session-1' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/workout-sessions/session-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('loads and saves the current follow plan preference', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: 0, data: { planId: null } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: 0, data: { planId: 'tanchengyi-private-coaching-follow-along' } }),
      });
    const { getCurrentPlanPreference, saveCurrentPlanPreference } = await import('./api');

    await expect(getCurrentPlanPreference()).resolves.toEqual({ planId: null });
    await expect(saveCurrentPlanPreference('tanchengyi-private-coaching-follow-along')).resolves.toEqual({
      planId: 'tanchengyi-private-coaching-follow-along',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/preferences/current-plan',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer secret-token' }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/preferences/current-plan',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ planId: 'tanchengyi-private-coaching-follow-along' }),
      }),
    );
  });

  it('clears the saved token when the API returns 401', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ code: 1, message: 'Unauthorized' }),
    });
    const { getWorkoutSessions } = await import('./api');

    await expect(getWorkoutSessions()).rejects.toThrow('访问密钥无效，请重新输入');

    expect(localStorage.getItem('fitness-pwa.api-token.v1')).toBeNull();
    expect(sessionStorage.getItem('fitness-pwa.api-token.v1')).toBeNull();
  });
});
