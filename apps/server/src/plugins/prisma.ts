import fp from 'fastify-plugin';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '../db.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

/** Exposes the Prisma client as `app.prisma` and disconnects it on shutdown. */
export default fp(async (app) => {
  app.decorate('prisma', prisma);
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
});
