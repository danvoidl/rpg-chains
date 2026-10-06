import type { IncomingHttpHeaders } from 'node:http';

/**
 * Builds a Web `Headers` object from Node's raw headers, so Better Auth can read the session
 * cookie from both Fastify requests and Socket.IO handshakes.
 */
export function toHeaders(raw: IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(raw)) {
    if (value) headers.append(key, Array.isArray(value) ? value.join(',') : value.toString());
  }
  return headers;
}
