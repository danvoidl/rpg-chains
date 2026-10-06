# rpg-chains

> `rpg-chains` é o nome de trabalho da **plataforma**. "As Sete Correntes" (referenciada na
> especificação) é apenas uma **campanha/história de exemplo** construída sobre ela, não o
> nome da plataforma.

Plataforma para **criar e jogar campanhas de RPG por turnos ao vivo**. Um mestre conduz um
grupo por capítulos de batalhas, lojas, fogueiras e narrativa. O combate é mediado por
perguntas: o grupo só age quando um integrante acerta o desafio na tela. Qualquer usuário
pode criar campanhas e jogá-las, e uma mesma campanha pode rodar em várias salas
simultâneas, cada uma com progresso independente.

Três camadas conceituais distintas em todo o código:

- **Campanha** — conteúdo autoral e reutilizável (rascunho editável + versões publicadas).
- **Sala** — instância viva de uma campanha, criada por outro usuário, com progresso próprio.
- **Perfil de Campanha** — o personagem de um jogador dentro de uma sala específica.

## Stack

TypeScript de ponta a ponta, monorepo pnpm + Turborepo.

| Camada                | Tecnologia                                    |
| --------------------- | --------------------------------------------- |
| Frontend              | Next.js (React)                               |
| API REST              | Fastify                                       |
| Tempo real            | Socket.IO                                     |
| Banco                 | PostgreSQL + Prisma                           |
| Validação / contratos | Zod                                           |
| Autenticação          | Better Auth                                   |
| Motor de combate      | Pacote TypeScript puro, testável isoladamente |

Hospedagem alvo: Railway ou Fly.io (processo Node de vida longa — serverless não segura
WebSocket nem estado de batalha em memória).

## Pré-requisitos

- Node ≥ 22 e pnpm 11 (`corepack enable`)
- Docker (para o Postgres de desenvolvimento)

## Começando

```bash
pnpm install

# Postgres em container (host na porta 5433)
pnpm db:up

# variáveis de ambiente (validadas por Zod, sem fallback no código)
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env.local

# migração inicial + Prisma Client
pnpm --filter @rpg-chains/server exec prisma migrate dev

# desenvolvimento
pnpm --filter @rpg-chains/server dev   # API + Socket.IO em :3001
pnpm --filter @rpg-chains/web dev      # web em :3000
```

## Scripts

```bash
pnpm turbo run build                 # build de tudo
pnpm turbo run typecheck lint test   # verificação completa
pnpm db:up / pnpm db:down            # sobe/derruba o Postgres

# um pacote específico / um único teste
pnpm --filter @rpg-chains/battle-engine test
pnpm --filter @rpg-chains/battle-engine exec vitest run src/decide.test.ts
pnpm --filter @rpg-chains/battle-engine exec vitest run -t "TapSignal"
```

## Estrutura do monorepo

```
apps/
  web/            # Next.js — visão do mestre, do jogador e editor (próximas fases)
  server/         # Fastify + Socket.IO + Prisma + Better Auth
packages/
  battle-engine/  # lógica pura de combate (decide/evolve), sem I/O
  shared-types/   # contratos Zod: entidades/snapshot, commands, events
  game-config/    # toda a parametrização de balanceamento
  eslint-config/  # ESLint flat config compartilhado
  tsconfig/       # tsconfig base compartilhado
```

## Arquitetura em uma frase

O motor de combate é um **fold puro sobre um log de eventos** (`decide` aplica as regras,
`evolve` reduz o estado); o servidor é transporte. Aleatoriedade vem de um **PRNG semeado
dentro do estado** (replay exato). Publicar uma campanha **congela um snapshot JSON imutável**
que a sala trava e joga até o fim. Estado de combate vive em memória (descartável); progressão
vive no Postgres (durável).

Os invariantes que atravessam vários arquivos — e que você deve preservar antes de mexer no
combate ou no versionamento — estão documentados em [CLAUDE.md](CLAUDE.md). A especificação
completa de produto, regras e balanceamento está em [`docs/spec.md`](docs/spec.md) e
[`docs/stack.md`](docs/stack.md).

## Status

**Fase 0 (fundação) concluída**: monorepo, modelo de dados, versionamento por snapshot,
contratos compartilhados, esqueleto do motor, autenticação. Próximas fases: autoria (1),
editor de classes/habilidades (1b), salas (2), motor de combate (3), progressão/economia (4),
fluxo de capítulo (5) e robustez ao vivo (6).
