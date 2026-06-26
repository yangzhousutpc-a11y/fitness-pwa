export const apiTokenKey = 'fitness-pwa.api-token.v1';

export function getApiToken(): string {
  const savedToken = localStorage.getItem(apiTokenKey) ?? sessionStorage.getItem(apiTokenKey);
  if (savedToken) {
    return savedToken;
  }

  return '';
}

export function setApiToken(token: string): void {
  localStorage.setItem(apiTokenKey, token);
}

export function clearApiToken(): void {
  localStorage.removeItem(apiTokenKey);
  sessionStorage.removeItem(apiTokenKey);
}
