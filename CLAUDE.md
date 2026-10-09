# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**rpg-chains** (working platform name) — a website to author and play (live, turn-based) RPG
campaigns. Combat is question-gated: the group only acts when a member answers a challenge
correctly. One campaign can be played by many independent rooms at once. Note: **"As Sete
Correntes" is an example campaign/story built on the platform, not the platform itself** — it
is the name used throughout the spec. The full product/system spec and stack rationale live in
[`docs/spec.md`](docs/spec.md) and [`docs/stack.md`](docs/stack.md) (section references like
"spec §4" point into `docs/spec.md`). The build phases run Fase 0 (foundation, done) →
1 (authoring) → 1b (class/skill editor) → 2 (rooms) → 3 (combat engine) →
4 (progression/economy) → 5 (chapter flow) → 6 (live robustness).

## Commands

pnpm + Turborepo monorepo (pnpm 11, Node ≥22). Run from the repo root.

```bash
pnpm install                      # install; runs prisma/esbuild build scripts (see allowBuilds note)
pnpm db:up                        # start Postgres (docker, host port 5433 — 5432 is taken)
pnpm db:down
pnpm turbo run build              # build all; runs before typecheck/test via task deps
pnpm turbo run typecheck lint test
```

Per-package (use `--filter`), and running a single test:

```bash
pnpm --filter @rpg-chains/battle-engine test           # one package's vitest
pnpm --filter @rpg-chains/battle-engine exec vitest run src/decide.test.ts
pnpm --filter @rpg-chains/battle-engine exec vitest run -t "TapSignal"   # by test name
pnpm --filter @rpg-chains/server dev                   # server (tsx watch); needs apps/server/.env
pnpm --filter @rpg-chains/web dev                      # Next.js on :3000
```

Prisma 7 (schema in `apps/server/prisma/schema.prisma`; connection URL + config in
`apps/server/prisma.config.ts`, **not** in the schema datasource):

```bash
pnpm --filter @rpg-chains/server exec prisma migrate dev --name <name>
pnpm --filter @rpg-chains/server exec prisma generate
pnpm --filter @rpg-chains/server db:studio
pnpm --filter @rpg-chains/server seed:playtest <email>   # Fase 3 playtest campaign for an existing account
```

Destructive Prisma CLI actions (`migrate reset`, and `migrate dev` when it needs to reset)
are gated by a Prisma 7 AI guard — they refuse to run for an agent without
`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=<the user's exact consent text>`. Ask the user
first; never self-consent.

This pnpm honors `allowBuilds:` (a name→bool map) in `pnpm-workspace.yaml`, **not
`onlyBuiltDependencies`** — dependency build scripts (esbuild, prisma) stay ignored unless
their entry is `true`, and vitest/prisma then silently lack their binaries.

Env is Zod-validated with no fallbacks (see `apps/server/src/env-schema.ts`): copy
`apps/server/.env.example` → `.env` and `apps/web/.env.example` → `.env.local`. A missing or
malformed value is a `.env` fix, never a code default.

## Architecture — the invariants that span files

**Package dependency is one-way and enforced by discipline, not tooling.** `apps/*` may
depend on `packages/*`; `packages/*` never on `apps/*`; and **IMPORTANT:
`packages/battle-engine` must never import anything that talks to DB, socket, or HTTP** —
only `@rpg-chains/shared-types` and `@rpg-chains/game-config` (both pure). This is what keeps
the engine testable with plain JSON fixtures. Do not break it.

**The battle engine is a pure fold over an event log.** It exposes two pure functions
(`packages/battle-engine/src/decide.ts`, `evolve.ts`):

- `decide(state, command, content) → { ok, events } | { ok: false, reason }` — **all combat
  rules**. `content` (`BattleContent`) is the immutable snapshot slice the battle started on,
  answer keys included; only `decide` reads it.
- `evolve(state, event) → state` — the fold. `replay(emptyBattle(id), events)` folds a whole log.
  **`evolve` never reads content**: every event carries resolved numbers (final damage, the applied
  effect), so a log replays on its own and the client folds the same events.

The server is dumb transport: it validates a Command, calls `decide`, persists/emits the
resulting Events, and applies `evolve`. **Clients only ever get `toPublicState`/`toPublicEvent`
(`public-view.ts`)**: no PRNG, no question deck, no answer key — the secrets live in
`BattleState.secret` so the projection is one omit. The socket sends a `ClientIntent` without an
actor; the server binds `profileId` from the session. The web folds the same events with
`evolvePublic` (`client-fold.ts`) from a `battle:sync` — never a hand-written client reducer. When adding combat logic, put rules in `decide` and
state transitions in `evolve`; never in the server.

**Command vs Event is a hard boundary.** A Command is a client _intent_ (may be rejected); an
Event is a consummated _fact_ (folded, rendered, logged). Both are Zod schemas in
`shared-types` (`commands.ts`, `events.ts`). Every command carries a `turnToken`; `decide`
rejects any whose token ≠ `state.turnToken` (stale/duplicate guard).

**Determinism — IMPORTANT: no `Math.random()` in the engine, ever.** All randomness comes from a seeded PRNG
(`prng.ts`) whose state (`{ seed, cursor }`) lives **inside** `BattleState` (`state.secret.prng`)
and is threaded purely; `decide` records each advance as a `PrngAdvanced` event. Inside one
`decide` call, rules go through a `DecideContext` (`decide-context.ts`): every emitted event is
folded at once (later rules see earlier hits) and the PRNG is written back once, at the end. Never
read `state.secret.prng` mid-call — draw through the context. `replay.test.ts` (200 seeds, a
deterministic robot) is the guard: replay = live state, same seed = same log, cursor advances. The seed enters via the `BattleStarted` event. Replaying a log reproduces every roll
exactly — keep it that way.

**Effect time skips the round it starts in** (spec §5.5): every `ActiveEffect` carries
`appliedRound`, and that round's `RoundEnded` neither counts it down nor ticks it; a skill cooldown
is stored as the round it is back (`skill-ready.ts`), never ticked. The 13 effect types resolve in
`effects/resolve-effect.ts`; target rules (`ALLOWED_TARGETS`) live in `shared-types` so the editor,
the publish gate and the engine share them.

**Effect stacking has two policies** (`stacking.ts`, spec §5.5). Attribute modifiers
(buff/debuff) **coexist and sum**: each application is an independent entry, and the signed
totals are computed **at read time** in two channels — flat and percent — resolved as
`(base + netFlat) × (1 + netPct)`, floored (percent is a live multiplier over base+flat, not a
value frozen at cast; multiple percents add before multiplying). No system-imposed cap; the
author bounds accumulation via magnitude/energy cost/cooldown/duration. **Every other
persistent effect** (stun, max-hp reduction, provoke, shield, DoT, HoT) **does not stack**: a
new application replaces the prior one and resets duration by `(type)` — summing control/
duration effects across sources would make a battle impossible (spec §5.6), a ceiling only the
system can guarantee.

**`shared-types` is the single contract hub** for three groups (all Zod → `z.infer` types):
entities/snapshot, Commands, Events. `battle-engine` and `apps/web` both import
`BattleState`/`BattleEvent` from here so client, server, and engine speak one language.

**Campaign versioning = immutable snapshots + a compatibility publish gate** (spec §2.2). The
draft lives in normalized Prisma tables and is freely editable. Publishing serializes the whole
version to one immutable JSON validated by `CampaignSnapshotSchema` (`shared-types/src/snapshot.ts`)
and stored in `CampaignVersion.snapshot` (jsonb) — a published version is never mutated. A room
does **not** lock forever: it tracks the latest published version and rolls forward to newer
**compatible** versions at safe boundaries (between battles / at a campfire, **never mid-battle**,
which keeps replay deterministic), so live rooms get new chapters and fixes without losing
progress. Treat "publish" as two gates, not a dump: a **validation gate** (an invalid draft must
fail to publish) and, from the second publish on, a **compatibility gate** — breaking changes
(deleting referenced content, changing a class's base stats or an item's kind) are refused;
only additive changes and non-breaking corrections publish (taxonomy in spec §2.2.1). Because
the gate compares versions **by id**, every draft write must keep ids stable — nested entities
are upserted by id (e.g. a class `PUT` updates its skills in place), never deleted and
recreated. Out-of-band balancing values are non-blocking `draftWarnings`; only `validateDraft`
issues block a publish. The battle engine and test fixtures read snapshots, never draft tables.

**Polymorphism is jsonb + Zod discriminated unions, not table-per-type.** Nodes (battle/shop/
campfire/narrative/boss) and the 13 effect types carry their type-specific params in `jsonb`
columns (`ChapterNode.config`, `Skill.effect`, `Villain.attacks`, `Item.weapon`/`Item.effect`)
validated by the discriminated unions in `shared-types/src/{content,effects}.ts`. Adding a new
effect type is a schema-only change, no migration.

**Chapter graph positions are world coordinates — never normalize them.** A node's `position`
(`posX/posY`) is an absolute pixel in the chapter's world, origin top-left. A chapter may carry a
`background` map (`imageUrl` + logical `width`×`height`, schema in `shared-types/src/content.ts`);
the image is always scaled to that logical size, so a node placed on a map pixel stays there even
if the author swaps the image for another resolution. Every chapter is drawn on the **trail**
(`shared-types/src/trail.ts`, Fase 5): a fixed-width column (`TRAIL_WIDTH`) that only grows down,
the same on phone and desktop, with nodes snapped to a 5-column grid — the editor snaps, the
publish gate checks, the player trail scales the column to the screen. Do not add auto-layout,
re-centering or position normalization anywhere (editor, server or snapshot). Node `title` is
author text, not an id.

**Room progress is stored facts + pure rules** (`campaign-rules/src/progress/`, spec §2.3, §3.7).
Only what happened is stored — a node cleared (with the room's `seq` and who took part), a
campfire lit, a chapter cleared; "unlocked" is always derived (`isNodeUnlocked`: edges are OR,
prerequisites are AND, the boss waits for every mandatory node). A defeat (`rollbackDefeat`)
undoes only the defeated players' clears in that chapter after its last lit campfire. Gate entry
with `checkNodeEntry` and record with the `record*` functions; never compute unlocks in the server
or the web. `progress-property.test.ts` is the guard, like the engine's `replay.test.ts`.

**Runtime vs durable state boundary** (spec §3.7): combat-transient state (the active battle,
its event log) lives **in memory**, which is the source of truth while the process runs.
Progression state (level, XP, equipment, the "caído"/downed flag) is durable in Postgres. Since
Fase 6 every accepted batch is also copied to the **battle journal** (`BattleJournal` +
`BattleJournalEntry`, `services/battle-journal.ts`) — after `apply`, never inside it, queued per
battle — only so a restart can bring the battle back (`services/battle-restore.ts`, on ready).
The journal stores no content (it is re-cut from the immutable version) and no state (it is the
fold); the write-back deletes it in its own transaction, so **a journal that exists is a battle not
yet written back**. Pending trade offers follow the same pattern (memory index, mirrored to
`TradeOffer` by `services/trade-offer-store.ts`, restored on ready). The concurrency unit is the
_battle_, keyed by `battleId` — not the room.

**Server structure = Fastify plugins + `buildApp()`.** `server.ts` is entrypoint only (build
app, listen, graceful shutdown). `app.ts` exports `buildApp()` which registers everything —
Socket.IO included — and returns the instance _without listening_: contract tests drive REST via
`app.inject()` (spec §6) and sockets by listening on port 0. Cross-cutting concerns are
decorators registered with `fastify-plugin` (`plugins/prisma.ts` → `app.prisma`;
`plugins/auth.ts` → the `/api/auth/*` route + an `authenticate` preHandler that sets `req.user`;
`plugins/realtime.ts` → `app.io` + `app.roomEvents`, session-checked handshake). Feature routes
are plugins under a prefix in `routes/` (register them in `buildApp`); socket handlers live in
`realtime/`. Do not put routes, auth, or handlers in `server.ts`.

**Rooms: REST mutates, the socket only signals** (Fase 2). Every room write is a REST route that
emits `app.roomEvents.changed(roomId)` after commit; the lobby socket carries presence and that
change signal, nothing else (`shared-types/src/room-realtime.ts`). Writes that read-then-write
room state (class slots, close) run in a transaction that first calls `lockRoom` (`SELECT … FOR
UPDATE`) — the slot race test fails without it. A room rolls forward to the latest published
version lazily, in `syncRoomVersion`, guarded by `app.battles.hasActive` (a forming battle counts).

**Battles: REST forms, the socket fights** (Fase 3). Forming/starting/cancelling are REST room
mutations (`routes/battles.ts`); in-battle intents go over `realtime/battle-channel.ts` with an
ack. All battle state is in `services/battle-registry.ts` (memory only), whose `apply` runs
`decide` → append → `evolve` **with no `await` in between** — that is the per-battle lock; keep
every registry check after a handler's last `await`. Timers, the channel broadcast and the profile
write-back are registry listeners. The battles plugin must be registered **before** `realtime`: its
`preClose` waits for the journal and drops the battles from memory first, so a shutdown leaves them
journaled for the next boot instead of writing every player back as dropped.
The master's **lobby** presence drives `MasterPresenceChanged` (`realtime/master-presence.ts`), so
the web keeps the lobby socket in the `/rooms/[roomId]` layout, alive across room ↔ battle pages.
**A dropped socket is a drop, not a departure** (Fase 6, spec §7): the last socket of a participant
leaving the battle channel (disconnect, reload, `battle:leave`) is `PlayerDisconnected` plus a
reconnection grace (`services/grace-timers.ts`, `RECONNECT_GRACE_MS`); joining again in time is
`PlayerReconnected`, the grace running out is `PlayerLeft`. Leaving on purpose is REST (`DELETE
/battles/:id/participants`). The master's lobby presence waits out the same grace
(`app.lobbyPresent`), so connection state is a fact in the log, never a server-side guess.

**Auth is Better Auth** (`apps/server/src/auth.ts`) backed by the Prisma adapter; its `User`
table doubles as the domain user account. Lucia is deprecated — do not reintroduce it. The
handler is mounted at `/api/auth/*` in `plugins/auth.ts` by bridging Fastify ⇄ the Web Fetch
API; protected routes use `{ preHandler: [app.authenticate] }`.

**Prisma connection lives outside the schema** (Prisma 7). The `datasource` block has only
`provider`; the URL is in `prisma.config.ts` (for Migrate/Studio) and the **runtime client
connects via the `@prisma/adapter-pg` driver adapter** in `apps/server/src/db.ts`
(`new PrismaClient({ adapter })`). Keep it that way — do not put `url` back in the schema.

## Conventions specific to this repo

- **One responsibility per file — never cram unrelated code together.** Split by
  responsibility and context: a file holds one cohesive thing (a module, a route, a plugin,
  a service, a schema group), not "all the logic". Do not put multiple React components in
  one file **unless** they are small and belong to the same context (e.g. a component and its
  tiny presentational sub-parts). Same for schemas, handlers, and utilities: unrelated
  concerns go in separate files. This is a hard rule — when a file starts mixing contexts,
  split it (this is why `server.ts` was broken into `app.ts` + `plugins/*` + `routes/*`).
- **All code is English** — identifiers, type/schema names, enum string values (e.g.
  `'battle'`, `'damage'`, `'strength'`), DB table and column names. The product spec is in
  Portuguese; do not mirror its terms into code. User-facing display strings and i18n come
  in a later phase; keep them out of identifiers.
- **All balancing numbers live in `@rpg-chains/game-config`** (spec §4) — attribute gains, the
  damage-formula constant, XP curve, relevance factor, class bands, default kit. Never
  hardcode these elsewhere; they change every playtest.
- ESM + NodeNext everywhere: **relative imports carry `.js` extensions** in `.ts` source.
- Packages build with plain `tsc` (not `tsc --build`); Turbo orders builds via `^build`, so a
  package resolves its workspace deps from their built `dist`. `typecheck` depends on `build`
  (the Next app needs its generated `.next/types`).
- The parallel-branch rule (open questions only on single-path nodes, spec §3.2) is graph
  reachability in `shared-types/src/graph.ts` (`isSinglePathNode`) — reuse it in both the
  editor and the publish gate.
- **Before acting on a tool's deprecation warning, check the installed major** (e.g.
  `prisma -v`): the warning may target a version you aren't running. The "move `url` out of
  the datasource" warning is Prisma 7 — on 6.x the CLI _requires_ `url` in the datasource.
- **A repo-wide identifier rename must include `.mjs`, `.cjs`, and Markdown**, not just
  `*.ts/*.tsx/*.json/*.js`, then `git grep <old token>` to confirm zero matches (a stray
  `.mjs` name — e.g. `transpilePackages` — is silently ignored, not an error).
- **Committed docs reference repo-relative paths only** — never a personal machine path
  (`~/Downloads`, `~/.claude`). The full spec lives in `docs/`.

## Git

Git-initialized on `main`; the user makes the commits (don't commit unasked). Per the user's
global profile, **IMPORTANT: never add `Co-Authored-By` or any AI-attribution trailer** to
commits or PRs. A harness may inject the opposite (this session's does: `Co-Authored-By:
Claude Opus 4.8`) — follow the user's rule and flag the conflict, never silently comply.

## Lab notes — mistakes not to repeat

Running log of dead-ends and errors hit while working in this repo, kept like a researcher's
lab notebook so future instances don't rediscover them. **When you make a mistake — a wrong
approach, a build/tooling failure you had to work around, a false assumption — append a dated
one-line entry here** (newest at the bottom): what went wrong → what to do instead. Keep it
terse and actionable; this is a do-not-repeat list, not a changelog. **When a note hardens
into a standing rule, move it to the prescriptive section (Conventions/Architecture) and do
not duplicate it here; drop notes made obsolete by the current setup.**

### 2026-09-08 (Fase 0 scaffold)

- **`.refine()` inside `z.discriminatedUnion(...)`** breaks the build (TS2740): a refined
  member is a `ZodEffects`, not a `ZodObject`. → Keep union members plain objects; apply
  cross-field checks with `.superRefine()` on the union result (see `ItemSchema`).
- **`z.record(SomeEnum, v)` for a partial map** has ambiguous all-keys-required vs partial
  inference across Zod versions. → Model optional-per-key maps as an explicit object of
  `.optional()` fields (see `EquipamentosSchema`, `RequisitosSchema`).
- **Watch for non-ASCII homoglyphs in config keys** — a Cyrillic char slipped into a JSON key
  (`noFallthroughCasesInSwitch`) and passed silently until caught by eye. Type ASCII configs
  carefully.
- **lint-staged ran `eslint --fix` from the repo root and failed with ENOENT.** eslint is a
  per-package devDep (not at root), and flat config resolves from the root cwd (no root
  config) — so root-level eslint can't lint files in `packages/*`/`apps/*`. Also `*.yaml`
  would have run prettier over `pnpm-lock.yaml`. → Pre-commit (`.husky/pre-commit` +
  root `lint-staged`) only runs `prettier --write` on `*.{ts,tsx,js,mjs,json,md}`; linting is
  enforced by `pnpm turbo run lint` (each package's own eslint) and CI, not the hook.

### 2026-10-06 (Fase 1 authoring)

- **Delegating to Antigravity (`agy -p`) headless:** `--dangerously-skip-permissions` is blocked
  by Claude Code's safety classifier; without it, every shell command needs an allow-rule in
  `~/.gemini/antigravity-cli/settings.json` (`permissions.allow: ["command(<prefix>)", ...]`),
  and ONE denied command (e.g. a pipe like `find … | sort`) silently aborts the whole run with
  "no output produced". Its Gemini quota is also small (exhausted after ~3 tasks, 7-day reset).
  → Keep delegated tasks small, forbid compound commands at the top of the prompt, and fall back
  to Sonnet subagents when `agy` fails.
- **Server `pnpm dev` did not load `.env`** (`config.ts` parses `process.env`; nothing loaded the
  file). → `tsx watch --env-file=.env`; tests load it via `test/test-database-url.ts`.

### 2026-10-06 (Fase 1b classes)

- **react-hook-form `field.onChange(obj)` drops any object with a `target` key** — it treats it as
  a DOM event and stores `obj.target.value` (an `Effect` has `target: 'self'` → `undefined`).
  → For object values with a `target` field, write with `setValue(name, obj)` instead (see
  `item-form.tsx`, `skill-fields.tsx`). Only an e2e that edits the value catches it.

### 2026-10-06 (Fase 3 setup)

- **Clean checkout: `pnpm install` does not generate the Prisma Client**, so the server build
  fails with "no exported member 'PrismaClient'". → Run
  `pnpm --filter @rpg-chains/server exec prisma generate` once after install (and after schema edits).
- **An explicit `Promise<T[]>` return type on a Fastify handler broke Prisma's `findMany`
  inference** (`row` became implicit `any`, TS7006, in `routes/catalog.ts`). → Leave the handler
  unannotated and type the mapper instead: `rows.map((row): T => ({ … }))`.
- **`pnpm add -D @rpg-chains/x@workspace:*` failed in zsh with "no matches found"** — the `*` is
  globbed. → Quote workspace specs: `'@rpg-chains/x@workspace:*'`.

### 2026-10-06 (Fase 3 M4)

- **vitest and Next transpile without type-checking**, so a type error in a package (a public
  event passed where `BattleEvent` was expected) passed the engine's tests and the e2e and only
  failed `tsc` in the full turbo run. → Before calling a package green, run its `build`/`typecheck`,
  not just its tests.
- **Running the e2e suite — or `pnpm turbo run build` — while a `next dev` is up broke it**:
  Playwright's own `next dev` and `next build` both write the same `apps/web/.next` (random
  `ERR_ABORTED` in the e2e; "Cannot find module './866.js'" and an unhydrated page on the dev
  server). → Stop the dev web server before `pnpm test:e2e`, and restart it (after
  `rm -rf apps/web/.next`) after any turbo `build`; if pages stop hydrating, that is why.

### 2026-10-07 (Fase 4 M1)

- **The local `.env` files point at the LAN IP** (`192.168.2.103`, for playtests on other devices),
  so a browser on `localhost:3000` gets "Falha na comunicação com o servidor" (CORS/auth origin).
  → To verify UI, kill whatever holds :3000/:3001 and start the `server-localhost` and
  `web-localhost` configs of `.claude/launch.json`, which override the URLs through the process
  env without touching `.env`.

### 2026-10-08 (Fase 5 M2)

- **Parallel agents running the server tests clash**: every run truncates the one
  `TEST_DATABASE_URL` database. → Give each agent its own database (`…/rpg_chains_test_a`) via
  `TEST_DATABASE_URL=…`; `prisma migrate deploy` creates it. Drop them afterwards.
- **`preview_start server-localhost` refused port 3001 as "another chat's server"** even after that
  process was killed, and the other session restarted its LAN server on 3001 mid-check (login then
  failed with 403). → Check `ss -ltnp | grep 3001` right before testing; run the API with
  `BETTER_AUTH_URL=http://localhost:3001 WEB_ORIGIN=http://localhost:3000 pnpm --filter
@rpg-chains/server dev` in a background shell when the preview tool refuses.
- **A LAN playtest broke two things localhost hides**: `crypto.randomUUID` is undefined outside a
  secure context (HTTPS or localhost) — use `lib/random-id.ts` in browser code; and uploads stored
  `http://localhost:9000/...` URLs (`S3_PUBLIC_BASE_URL`) that phones cannot load. → For a LAN
  playtest point `S3_ENDPOINT`/`S3_PUBLIC_BASE_URL` at the LAN IP before uploading, and test the
  web over the LAN IP, not just localhost.

### 2026-10-09 (deploy plan)

- **`@aws-sdk/client-s3` ≥ 3.729 presigns a CRC32 of an empty body** (`x-amz-checksum-crc32=AAAAAA==`)
  into PutObject URLs, so R2 rejects the browser's real upload. → Keep
  `requestChecksumCalculation`/`responseChecksumValidation: 'WHEN_REQUIRED'` in `storage.ts`.
- **Better Auth 1.7 drops a multi-hop `X-Forwarded-For`** unless `trustedProxies` is set, leaving the
  rate limit keyless; Fastify `trustProxy` does not help (nothing reads `req.ip`). → On Render read
  Cloudflare's single-value `cf-connecting-ip` first (`auth.ts`).
- **Turbo 2 runs tasks in strict env mode**: only variables declared in a `turbo.json` reach them.
  Locally `dotenv` reads `.env` and hides it; the first CI run failed with "TEST_DATABASE_URL is
  required". → A task that reads new env vars needs them in `passThroughEnv`/`env`
  (`apps/server/turbo.json`); reproduce CI in a worktree with no `.env`.
