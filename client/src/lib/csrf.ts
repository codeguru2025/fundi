/**
 * Reads the CSRF token from the `csrf-token` cookie.
 * Returns the token string or empty string if not set.
 */
export function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

/**
 * Returns headers object with CSRF token included for mutating requests.
 */
export function csrfHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { ...extra, "x-csrf-token": getCsrfToken() };
}
