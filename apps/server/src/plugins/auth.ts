import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { auth } from '../auth.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** preHandler that rejects unauthenticated requests and sets `req.user`. */
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user: { id: string } | null;
  }
}

/** Build a Web `Headers` object from Fastify's raw headers. */
function toHeaders(raw: FastifyRequest['headers']): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(raw)) {
    if (value) headers.append(key, Array.isArray(value) ? value.join(',') : value.toString());
  }
  return headers;
}

/**
 * Mounts Better Auth at `/api/auth/*` (bridging Fastify ⇄ the Web Fetch API) and exposes an
 * `authenticate` preHandler for protected routes. Keeps all auth wiring out of the entrypoint.
 */
export default fp(async (app) => {
  app.decorateRequest('user', null);

  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    async handler(request, reply) {
      try {
        const url = new URL(request.url, `http://${request.headers.host}`);
        const req = new Request(url.toString(), {
          method: request.method,
          headers: toHeaders(request.headers),
          body: request.body ? JSON.stringify(request.body) : undefined,
        });
        const response = await auth.handler(req);
        reply.status(response.status);
        response.headers.forEach((value, key) => reply.header(key, value));
        reply.send(response.body ? await response.text() : null);
      } catch (err) {
        app.log.error(err, 'better-auth handler failed');
        reply.status(500).send({ error: 'auth_handler_failure' });
      }
    },
  });

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await auth.api.getSession({ headers: toHeaders(request.headers) });
    if (!session) {
      reply.code(401).send({ error: 'unauthorized' });
      return;
    }
    request.user = { id: session.user.id };
  });
});
