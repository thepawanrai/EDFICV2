let cachedCsrfToken: string | null = null;
let inMemorySessionToken: string | null = null;

export function setInMemorySessionToken(token: string | null): void {
  inMemorySessionToken = token;
}

export function getInMemorySessionToken(): string | null {
  return inMemorySessionToken;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function ensureCsrfToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const fromCookie = readCookie('edfic_csrf');
    if (fromCookie) {
      cachedCsrfToken = fromCookie;
      return fromCookie;
    }
    if (cachedCsrfToken) return cachedCsrfToken;
  }

  const res = await fetch('/api/v1/auth/csrf', { credentials: 'include' });
  const data = (await res.json()) as { csrfToken: string };
  cachedCsrfToken = data.csrfToken;
  return data.csrfToken;
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit & { isFormData?: boolean } = {},
  _csrfRetried = false
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});

  if (inMemorySessionToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${inMemorySessionToken}`);
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = await ensureCsrfToken(_csrfRetried);
    headers.set('X-CSRF-Token', csrf);
    if (!options.isFormData && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  const response = await fetch(url, {
    ...options,
    method,
    headers,
    credentials: 'include',
  });

  // Update cached CSRF token if cookie refreshed
  const latestCookie = readCookie('edfic_csrf');
  if (latestCookie) {
    cachedCsrfToken = latestCookie;
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (
    response.status === 403 &&
    !_csrfRetried &&
    !['GET', 'HEAD', 'OPTIONS'].includes(method)
  ) {
    cachedCsrfToken = null;
    return apiFetch<T>(url, options, true);
  }

  if (!response.ok) {
    const errorMessage =
      payload?.error || `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return payload as T;
}

export async function downloadAuthenticatedFile(
  url: string,
  fallbackFileName: string
): Promise<void> {
  const headers = new Headers();
  if (inMemorySessionToken) {
    headers.set('Authorization', `Bearer ${inMemorySessionToken}`);
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const payload = isJson ? await response.json().catch(() => null) : null;
    throw new Error(payload?.error || `Download failed with status ${response.status}`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const fileMatch = disposition.match(/filename="?([^";]+)"?/i);
  const downloadName = (fileMatch?.[1] || fallbackFileName).replace(/[^a-zA-Z0-9._-]/g, '_');

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = downloadName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

