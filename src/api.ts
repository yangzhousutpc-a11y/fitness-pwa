import { clearApiToken, getApiToken } from './auth';
import type { CoachPlan, WorkoutSession } from './types';

type ApiResponse<T> = {
  code: number;
  data?: T;
  message?: string;
};

const defaultApiBaseUrl = 'http://localhost:3000';

function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl).replace(/\/$/, '');
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiToken()}`,
      ...init.headers,
    },
  });
  const body = (await response.json()) as ApiResponse<T>;

  if (response.status === 401) {
    clearApiToken();
    throw new Error('访问密钥无效，请重新输入');
  }

  if (!response.ok || body.code !== 0) {
    throw new Error(body.message || '数据库同步失败');
  }

  return body.data as T;
}

export function getCustomPlans(): Promise<CoachPlan[]> {
  return requestJson<CoachPlan[]>('/api/custom-plans');
}

export function saveCustomPlan(plan: CoachPlan): Promise<CoachPlan> {
  return requestJson<CoachPlan>(`/api/custom-plans/${encodeURIComponent(plan.id)}`, {
    method: 'PUT',
    body: JSON.stringify(plan),
  });
}

export function deleteCustomPlan(planId: string): Promise<{ id: string }> {
  return requestJson<{ id: string }>(`/api/custom-plans/${encodeURIComponent(planId)}`, {
    method: 'DELETE',
  });
}

export function getWorkoutSessions(): Promise<WorkoutSession[]> {
  return requestJson<WorkoutSession[]>('/api/workout-sessions');
}

export function saveWorkoutSession(session: WorkoutSession): Promise<WorkoutSession> {
  return requestJson<WorkoutSession>('/api/workout-sessions', {
    method: 'POST',
    body: JSON.stringify(session),
  });
}
