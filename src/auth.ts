export const apiTokenKey = 'fitness-pwa.api-token.v1';

export function getApiToken(): string {
  const savedToken = sessionStorage.getItem(apiTokenKey);
  if (savedToken) {
    return savedToken;
  }

  return '';
}

export function clearApiToken(): void {
  sessionStorage.removeItem(apiTokenKey);
}
