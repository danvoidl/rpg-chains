import { config } from './config';

/** Represents an HTTP error thrown by apiFetch when the status is not 2xx. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API request failed with status ${status}`);
    this.name = 'ApiError';
  }
}

/**
 * Performs an authenticated fetch against the backend API with JSON handling.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const normalizedBase = config.apiUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${normalizedBase}${normalizedPath}`;

  const { json, headers: customHeaders, ...restInit } = init ?? {};
  const headers = new Headers(customHeaders);
  let body = restInit.body;

  if (json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(json);
  }

  const response = await fetch(url, {
    ...restInit,
    headers,
    body,
    credentials: 'include',
  });

  if (!response.ok) {
    let errorBody: unknown = undefined;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      try {
        errorBody = await response.json();
      } catch {
        errorBody = undefined;
      }
    } else {
      try {
        errorBody = await response.text();
      } catch {
        errorBody = undefined;
      }
    }
    throw new ApiError(response.status, errorBody);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
