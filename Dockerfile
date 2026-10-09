# Playtest image (Fase 6 plan M8, deployed on Render — see docs/phase-6-playtest.md): one
# container, one instance. Caddy on $PORT (8080 by default) sits in front of the web (Next, :3000)
# and the API (Fastify + Socket.IO, :3001), so the page, the auth cookie and the socket share one
# origin — no cross-site cookie for a phone browser to block. Battles live in this process's
# memory (with the journal for restarts), so the app must run on ONE instance.
FROM node:22-slim

# OpenSSL for the Prisma CLI (migrations run at boot).
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@11.15.1
COPY --from=caddy:2 /usr/bin/caddy /usr/bin/caddy

WORKDIR /app
COPY . .

# Inlined into the browser bundle at build time: the public URL of the app itself.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm install --frozen-lockfile
# prisma.config.ts insists on a URL; generating the client never connects.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
    pnpm --filter @rpg-chains/server exec prisma generate
RUN pnpm turbo run build --filter=@rpg-chains/server... --filter=@rpg-chains/web...

ENV NODE_ENV=production
EXPOSE 8080
CMD ["bash", "deploy/start.sh"]
