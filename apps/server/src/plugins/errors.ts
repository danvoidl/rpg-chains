import fp from 'fastify-plugin';
import { ZodError } from 'zod';

/**
 * Maps a failed Zod parse anywhere in a route to a 400 with the issue list, so handlers can
 * just `Schema.parse(request.body)`. Everything else keeps Fastify's default handling.
 */
export default fp(async (app) => {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: 'invalid_body', issues: error.issues });
    }
    return reply.send(error);
  });
});
