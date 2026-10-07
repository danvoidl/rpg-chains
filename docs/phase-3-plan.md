# Fase 3 — Motor de combate: plano detalhado

_Escopo de [spec §8](spec.md): fila de iniciativa, sinal com rotação, dois modos de pergunta, HP e
energia, resolução dos efeitos do catálogo com duração e empilhamento, cooldowns, alvo dos
inimigos, fórmula de dano, morte e reerguer. Regras de domínio em spec §3 (combate), §4.2–4.3
(dano, vida, energia), §5.3–5.5 (habilidades, efeitos, empilhamento) e na tabela de `percent` de
[phase-1b-kit-draft.md](phase-1b-kit-draft.md)._

**Status (2026-10-06):** decisões 1–13 aprovadas; as marcadas **(spec)** já estão gravadas na
spec (§3.2, §3.3, §3.5, §3.7, §4.1, §4.2, §5.4, §5.5) e a §9 foi fechada. A remoção das chaves
mortas de `ATTRIBUTE_GAINS` (decisão 6) é código e fica no M1.

## Objetivo e critério de pronto

Numa sala com perfis criados (Fase 2), um jogador abre uma batalha num nó de batalha ou chefe → 1
a N jogadores entram na formação (respeitando `participantLimit`) → alguém inicia → a iniciativa é
sorteada → no turno do grupo todos veem o sinal e uma pergunta → o primeiro a tocar responde → se
acerta, ataca, usa uma habilidade ou um consumível; se erra, a vez passa ao próximo inimigo → os
vilões atacam em fila circular, respeitando provocação e atordoamento → efeitos com duração,
cooldowns, escudo, cura, dano contínuo e reerguer funcionam como no catálogo → a batalha termina
em vitória ou derrota, e HP, energia e "caído" voltam para o perfil. Uma batalha com pergunta
aberta só começa com o mestre online, e ele julga as respostas. **Reaplicar o log de eventos a
partir do `BattleStarted` reproduz o estado final exato** — este é o teste que fecha a fase.

## Pendências herdadas (resolver no M0)

Verificação de 2026-10-06 sobre `develop`:

1. **Suíte não verificada neste ambiente.** A máquina usada no levantamento não tinha Node, pnpm,
   Docker nem `node_modules`. Antes de começar: `pnpm db:up`, `pnpm turbo run typecheck lint test`
   e o e2e `apps/web/e2e/rooms.spec.ts` verdes.
2. **`develop` está 4 commits à frente de `main`** (toda a Fase 2). Abrir/mesclar o PR antes de
   ramificar a Fase 3, para a fase nova não carregar a anterior no diff.
3. **Spec §9 tem duas pendências que esta fase precisa fechar** (decisões 1 e 2 abaixo): o mestre
   joga? e o que acontece quando ele cai numa batalha com pergunta aberta.
4. **Ganchos deixados pela Fase 2 para cá** (já previstos, não são bugs):
   `services/active-battles.ts` (`hasActiveBattle` sempre `false`), os `TODO(Phase 3)` de
   `decide.ts`/`evolve.ts`, o retrabalho anotado em `stacking.ts` e em `ActiveEffectSchema`
   (canal fixo/percentual, sem dedup de modificadores de atributo), e dois testes que o
   plano da Fase 2 deixou como risco: "batalha fixa a versão até o fim" e "sala não fecha nem
   avança versão no meio de batalha".
5. **Arestas pequenas da Fase 2**, baratas de corrigir junto:
   - `room:join` do lobby aceita sala `closed`; deveria recusar.
   - Quem abandona a sala ou perde o papel de mestre continua no canal do socket até desconectar.
     Para o lobby é inofensivo, mas a Fase 3 **não pode** confiar em "estar no canal" como
     autorização: todo comando de batalha revalida o vínculo usuário → perfil → batalha.
   - `GET /api/rooms/:id?code=` leva o código de acesso na query string (fica em log de acesso e
     histórico do navegador). Mover para header ou para o corpo de um `POST`. Baixa prioridade.
6. **Lacunas de regra que a spec não fecha** (decisões 4–8 abaixo): relógio das durações, escala
   do ataque de vilão, papel de `ATTRIBUTE_GAINS.*WeaponDamage` diante da escala do item, poder de
   habilidade da inteligência, timers e estado pós-batalha.

## Fora do escopo

- **XP, nível, loot, ouro, bolsa, distribuição de pontos** → Fase 4. A vitória não dá recompensa;
  o perfil continua nível 1 (só habilidades de nível 1 aparecem fora das fixtures).
- **Desbloqueio de nós, conclusão de capítulo, fogueira, volta à última fogueira na derrota** →
  Fase 5. Aqui qualquer nó `battle`/`boss` da versão vigente pode ser aberto (decisão 9).
- **Reconexão com período de graça, retomada após crash, múltiplas instâncias** → Fase 6. Aqui a
  queda tira o jogador da batalha na hora (spec §7) e um crash perde a batalha (spec §3.7).
- **Mapa/visual do grafo para escolher o nó** → fase do mapa. A Fase 3 usa uma lista simples.
- **Crítico, esquiva, variação aleatória de dano**: a spec não define; o dano é determinístico.

## Decisões de design (aprovadas)

Cada uma tem uma recomendação; as marcadas com **(spec)** mudam ou completam o texto da spec e
devem ser gravadas lá quando aprovadas.

1. **(spec §9) O mestre joga?** Recomendado: o mestre pode ter perfil (como hoje), mas **não entra
   como combatente em batalha que tenha pergunta aberta** — ali ele é juiz. Em batalha só com
   objetivas, ele entra como qualquer jogador. Resolve "julgar a própria resposta" sem proibir o
   mestre-jogador em grupos pequenos. Consequência: a transferência de mestre é recusada
   (`409 battle_needs_master`) enquanto houver batalha com pergunta aberta rodando, e quem recebe o
   papel no meio de uma batalha objetiva continua nela normalmente.
   Alternativa: mestre nunca combate. Mais simples de explicar, inviabiliza grupos de 2–3.
2. **(spec §9) Mestre cai numa batalha com pergunta aberta.** Recomendado: a presença do mestre
   vira evento no log (`MasterPresenceChanged`), então a regra é determinística. Enquanto ele
   estiver fora, o turno do grupo **usa as perguntas objetivas do nó**, se houver; se o nó só tem
   abertas, a batalha **pausa** no início do turno do grupo (inimigos também não agem) até ele
   voltar ou o mestre/participantes cancelarem (decisão 10). Uma resposta aberta já enviada fica
   aguardando julgamento.
3. **Contexto de batalha separado do estado.** `decide(state, command, content)` recebe um
   `BattleContent` imutável (vilões, perguntas com gabarito, habilidades por classe, itens) montado
   do snapshot da versão em que a batalha começou. **`evolve` não recebe conteúdo**: todo evento
   carrega os números já resolvidos (dano final, cura efetiva, efeito aplicado com canal e valor).
   Assim o cliente faz o mesmo fold sem nunca receber gabarito, e `replay(log)` não depende de
   snapshot. Alternativa: embutir o conteúdo no estado — vaza `correctIndex` para o cliente.
4. **(spec §5.4) Um relógio só: a rodada do grupo.** Rodada = um turno do grupo (como o kit
   assume). Ao **fim de cada turno do grupo** (ação executada, resposta errada ou tempo esgotado):
   dano/cura contínuos aplicam um tique em todos os alvos, durações e cooldowns de habilidade
   decrementam, efeitos com 0 expiram. Exceções que contam outra coisa: **atordoar** conta turnos
   próprios do alvo perdidos (spec: "perde o próximo turno"), **provocar** conta ataques inimigos
   redirecionados (`PROVOKE_DEFAULT_DURATION_ATTACKS`), e o **cooldown de ataque de vilão** conta
   turnos daquele vilão. Muda o texto "dano no início do turno do alvo": com 3 vilões, um DoT de 3
   rodadas que só tica no turno do alvo daria 1 tique em vez dos 3 que o kit (Sangria, 8 × 3)
   pressupõe.
5. **(spec §4.2) Dano do ataque de vilão = `baseDamage` do ataque**, reduzido pela defesa do alvo.
   Força/destreza/inteligência do vilão não entram na Fase 3; só `defense` é lida. Motivo: a spec
   diz "mesma fórmula" mas o ataque não tem atributo nem escala, e inventar um é regra escondida.
   Se o playtest pedir, adiciona-se `scalingAttribute`/`scale` opcionais ao `VillainAttack`
   (aditivo, compatível). Debuff de dano no vilão (`Brado Intimidador`) age sobre esse valor.
6. **(spec §4.1) A escala da arma é a do item.** Dano bruto do ataque =
   `weapon.baseDamage + atributoEfetivo(weapon.scalingAttribute) × weapon.scale`.
   `ATTRIBUTE_GAINS.strength.heavyWeaponDamage` e `dexterity.lightWeaponDamage` não são usados
   (remover de `game-config` e da tabela da spec, ou rebatizar como faixa recomendada de escala).
   **Inteligência não tem "poder de habilidade" implícito**: escala só via magnitude `scaling`
   com `intelligence` (proposta do kit, que já assume isso). `skillPower` sai de `ATTRIBUTE_GAINS`.
7. **Regras finas de resolução** (todas em `decide`, números em `game-config`):
   - Ordem do dano: bruto → `(bruto + netFlat(damage)) × (1 + netPct(damage))` do atacante →
     redução pela defesa efetiva do alvo → escudo absorve → HP. Arredonda para baixo; **mínimo 1**
     se o bruto for > 0 (`MIN_DAMAGE` em `game-config`). Dano de habilidade usa a mesma cadeia
     (o kit conta com Fervor ampliando Juízo Final).
   - Defesa efetiva do jogador = `Σ defenseBonus do equipamento + força × 2 + destreza × 1`
     (atributos já com buffs), depois os modificadores de `defense`. Vilão: `attributes.defense`
     com modificadores.
   - Buffs de força/destreza/inteligência afetam dano e defesa, **não** vida/energia máximas
     (os tetos ficam fixos durante a batalha; só `max_hp_reduction` mexe na vida máxima).
   - Cura e restauração respeitam o teto efetivo; cura em caído não faz nada (só reerguer).
   - Cair: HP 0 → `downed`, efeitos removidos, cooldowns mantidos. Reerguer volta com
     `healthPercent` da vida máxima.
   - `percent` por tipo segue a tabela do kit; `damage` em `percent` = % do dano bruto do ataque
     básico de quem lança.
   - Rotação (spec §3.3): só quem **agiu** fica bloqueado na rodada seguinte; errar não bloqueia.
     Caídos e quem saiu não são elegíveis; sem elegíveis, o bloqueio é ignorado.
   - Escolha de ataque do vilão: sorteio (PRNG) entre os ataques fora de cooldown; se nenhum,
     o de menor cooldown restante. Alvo único: sorteio entre jogadores vivos e presentes;
     provocação ativa redireciona ao provocador e converte área em alvo único.
   - Pergunta objetiva: sorteada de um "baralho" embaralhado com o PRNG, sem repetir até esgotar
     o pool do nó. Nó sem pergunta nenhuma não pode ser iniciado (`422 node_without_questions`).
8. **Timers vivem no servidor, a regra no motor.** Sinal sem toque, resposta sem envio e ação sem
   escolha expiram (`BATTLE_TIMERS` em `game-config`, valores de playtest). O servidor agenda e,
   ao estourar, envia um **comando de sistema** (`SignalExpired`, `AnswerTimedOut`,
   `ActionTimedOut`) com o `turnToken` vigente; `decide` trata como turno perdido. Token velho é
   rejeitado como qualquer comando. O julgamento do mestre **não** expira (pausa, decisão 2).
   Sem isso, um jogador ausente congela a batalha — não dá para adiar para a Fase 6.
9. **Abrir batalha não depende do grafo na Fase 3.** Qualquer membro com perfil não caído abre uma
   formação num nó `battle`/`boss` da versão vigente; no máximo uma batalha por nó por sala.
   A Fase 5 acrescenta o gate de desbloqueio na mesma rota. Formação e início são **REST**
   (mutação de sala, mesma regra da Fase 2); comandos dentro da batalha são **socket com ack**.
10. **Cancelar = descartar.** Nada da batalha é gravado antes do fim, então cancelar (mestre, ou
    todos os participantes restantes) apenas apaga a batalha da memória — é o "reiniciar" da
    spec §7 na sua forma mínima. Cair da batalha (desconexão) gera `PlayerLeft`: o jogador sai da
    elegibilidade e dos alvos; o estado dele no momento da saída é o que volta ao perfil no fim.
11. **Estado pós-batalha.** No `BattleResolved`, uma transação grava `currentHp`, `currentEnergy` e
    `downed` de cada participante (inclusive quem saiu). Na derrota todos ficam caídos. Como a
    fogueira é da Fase 5, entra um **"descanso" provisório do mestre** (`POST
/api/rooms/:id/rest`) que chama a mesma função pura de restauração que a fogueira vai usar
    (`restoreAtCampfire`), e some da UI quando a Fase 5 chegar. Caído não entra em formação.
    Alternativa: não gravar nada até a Fase 5 — mais simples, mas adia o invariante "caído é
    durável" que a spec e o CLAUDE.md já prometem.
12. **Log autocontido.** `BattleStarted` carrega o elenco inicial completo (combatentes e inimigos,
    sem segredos) além de seed e iniciativa: `replay(emptyBattle, log)` reconstrói tudo. O cliente
    que conecta no meio recebe `{ state público, seq }` e segue pelos eventos.
13. **Projeção pública.** O cliente nunca recebe `prng` (preveria sorteios) nem gabarito.
    `SignalOpened` carrega a pergunta já projetada (`prompt`, `options`, sem `correctIndex`), o que
    também cobre a pergunta aberta criada pelo mestre durante o combate (spec §3.2) sem id no
    snapshot. Um teste varre todo payload emitido procurando `correctIndex`/`seed`.

## Mudanças de contrato (`shared-types`) e de schema

Sem migration: batalha é memória (spec §3.7). Só contratos Zod.

- `battle-state.ts`
  - `ActiveEffectSchema` vira união discriminada por `kind`: `stat_modifier { stat, channel:
'flat'|'percent', value, rounds, sourceId }`, `damage_over_time { perRound, rounds }`,
    `heal_over_time`, `shield { remaining, rounds }`, `provoke { attacks }`, `stun { turns }`,
    `max_hp_reduction { amount, rounds }`.
  - `Combatant` ganha `name`, `classId`, `level`, `attributes`, `weapon` (resolvida), `skillIds`
    disponíveis, `consumables`, `left: boolean`; `Enemy` ganha `name`, `defense`, `attacks`
    resumidos, `stunned` via efeito.
  - `BattleState` ganha `nodeId`, `turn` como máquina de estados (`awaiting_signal` →
    `awaiting_answer` → `awaiting_judgement` → `awaiting_action`, ou `paused`), `questionDeck`,
    `masterOnline`, `needsMaster`, `lastActorId`.
- `battle-content.ts` (novo, só servidor): `BattleContentSchema` — vilões do nó, perguntas do nó
  com gabarito, habilidades por classe, itens referenciados.
- `commands.ts`: separar `ClientCommandSchema` (o que o socket aceita) de `SystemCommandSchema`
  (`PlayerLeft`, `MasterPresenceChanged`, `SignalExpired`, `AnswerTimedOut`, `ActionTimedOut`).
  O `profileId` do comando de cliente é **preenchido pelo servidor** a partir da sessão, nunca
  confiado do payload. Novos comandos de cliente do mestre: `PresentQuestion { questionId } |
{ prompt }` (aberta, inclusive ad hoc) e `JudgeOpenAnswer` (já existe).
- `events.ts`: eventos com números resolvidos — `EffectApplied` com o `ActiveEffect` inteiro,
  `ShieldAbsorbed`, `EnergyChanged`, `CooldownStarted`, `EnemyTurnSkipped`, `ProvokeConsumed`,
  `OverTimeTicked`, `RoundEnded`, `PlayerLeft`, `MasterPresenceChanged`, `BattlePaused/Resumed`,
  `SignalOpened { question: PublicQuestion }`, `OpenAnswerSubmitted { text }`.
- `battle-realtime.ts` (novo): `battle:join`, `battle:command` (ack `{ ok } | { ok: false,
reason }`), `battle:events { battleId, fromSeq, events }`, `battle:sync` → `{ state, seq }`,
  `PublicBattleStateSchema`, `PublicQuestionSchema`.
- `rooms.ts`: `RoomDetail` ganha `battles: BattleSummary[]` (formando/rodando, nó, participantes).
- `game-config`: `BATTLE_TIMERS`, `MIN_DAMAGE`, constantes da defesa derivada (as chaves `defense`
  de `ATTRIBUTE_GAINS` já existem); remover `*WeaponDamage` e `skillPower` (decisão 6).

## Marcos

`[eu]` = invariantes, determinismo, concorrência; `[delegável]` = mecânico, com contrato de tarefa.
A fase anda em **três etapas** seguindo a recomendação da spec §8 (fatia vertical primeiro):
**A** combate mínimo de ponta a ponta (só pergunta objetiva e ataque básico), **B** catálogo de
efeitos, **C** mestre e perguntas abertas.

### M0 — Pré-requisitos e decisões

**Status (2026-10-06): feito**, com três ajustes ao texto original:

- Pendência 1 verificada (suíte inteira + e2e verdes). Pendência 2 (mesclar `develop` em `main`)
  é do usuário. Decisões gravadas na spec e §9 fechada.
- Pendência 5: `room:join` agora recusa sala encerrada (`room_closed`, com teste). O "revalidar a
  cada comando" é regra do M3, não correção da Fase 2. **O código de acesso na query string ficou
  de fora**: ele também está na URL da página (`/rooms/:id?code=`), que funciona como link de
  convite, e tirá-lo muda o fluxo da web, não só a API. Fica para decidir junto com o polimento de
  salas.
- Fixtures do motor são **snapshots publicados**, não `BattleContent`: o schema de conteúdo só nasce
  no M1, e o conteúdo da batalha é derivado do snapshot do mesmo jeito que o servidor fará
  (`buildBattleContent`). Ficaram em `packages/battle-engine/src/fixtures/`: `snapshot-basic.json`
  (Etapa A: 2 classes só com ataque básico, 1 vilão, 3 perguntas objetivas), `snapshot-catalog.json`
  (os 13 tipos de efeito como habilidades de nível 1, mais 2 consumíveis) e `kit-snapshot.ts`, que
  **deriva** classes e armas de `DEFAULT_CLASS_KIT` para os testes de cenário acompanharem os ajustes
  de playtest (ids `cl-<key>`, `it-<key>-weapon`, `sk-<key>-<n>`; o chefe tem uma pergunta aberta).
  `load.ts` valida cada uma pelo `CampaignSnapshotSchema`; `fixtures.test.ts` garante referências
  resolvidas, alvos permitidos por tipo (`ALLOWED_TARGETS`, via devDependency em `campaign-rules`)
  e cobertura dos 13 tipos.
- O helper `runBattle` **foi para o M2**: ele depende de `createBattle` e do contrato do M1.

### M1 — Contratos (Etapa A)

**Status (2026-10-06): feito.** Contratos em `shared-types` (`battle-effects.ts`,
`battle-question.ts`, `battle-state.ts`, `battle-content.ts`, `commands.ts`, `events.ts`,
`battles.ts`, `battle-realtime.ts`), `toPublicState`/`toPublicEvent`/`toPublicQuestion` em
`battle-engine/src/public-view.ts` com o teste de vazamento, e `ATTRIBUTE_GAINS` sem
`*WeaponDamage`/`skillPower` (`MIN_DAMAGE` e `BATTLE_TIMERS` em `combat.ts`). `decide`/`evolve` foram
adaptados só o bastante para o `TapSignal` existente continuar funcionando; o resto é M2. Ajustes
em relação à lista de contratos acima:

- **Segredos num sub-objeto**: `BattleState = PublicBattleState + { secret: { prng, questionDeck } }`.
  O avanço do PRNG e o reembaralhamento do baralho viram eventos só do servidor (`PrngAdvanced`,
  `QuestionDeckShuffled`), descartados por `toPublicEvent`, que também tira semente e baralho do
  `BattleStarted`. `battle:events` leva `fromSeq..toSeq` do log do servidor, então uma lacuna
  significa "pedir sync", não "evento perdido".
- **Eventos**: o escudo entra em `DamageDealt.absorbed` (sem `ShieldAbsorbed`); a expiração por tempo
  é implícita no `RoundEnded` e a remoção por regra é `EffectRemoved { reason }`; provocação e
  atordoamento diminuem em `ProvokeConsumed`/`EnemyTurnSkipped`; o cooldown do ataque de vilão vai no
  `EnemyActed`. Entraram `QuestionRequested`, `TurnLost`, `EnemyDefeated`; saiu `BattleResumed` (a
  retomada emite direto o próximo estágio). Todo evento que muda de estágio traz o `turnToken` novo.
- **Comandos** não levam mais `battleId` (o servidor roteia pela batalha). `ClientIntent` (socket,
  sem ator) é separado de `Command` (motor); comandos de presença não têm `turnToken` e nunca ficam
  velhos.
- **Estado**: todo efeito ativo tem `id` e `sourceId` (para expirar/dissipar uma aplicação só);
  `Enemy` não guarda os ataques (o `decide` lê do conteúdo) e ganhou `imageUrl`; saiu `lastActorId`
  (`blockedFromSignal` já cobre a rotação); `turn` tem os estágios `starting` e `enemy` (transitório)
  além dos do plano.
- **Adiantado do M2/M6**: `signal.ts` extraído de `decide.ts`, e `stacking.ts` já no modelo final
  (modificadores coexistem; `netModifiers` por canal; `applyModifiers` =
  `(base + flat) × (1 + pct)`, piso, mínimo 0).

- [eu] Schemas novos/alterados acima, com `snapshot.test.ts`-style round-trip para cada um.
- [eu] `toPublicState` / `toPublicQuestion` em `battle-engine` + teste de "nenhum segredo vaza".
- [delegável] Remover as chaves mortas de `ATTRIBUTE_GAINS`, ajustar `derive-stats` e a spec §4.1.

### M2 — Motor, laço central (Etapa A)

**Status (2026-10-06): feito.** O motor joga uma batalha inteira só com perguntas objetivas e
ataque básico: `createBattle` (elenco validado, iniciativa e baralho pelo PRNG, `BattleStarted`
autocontido e o primeiro turno), sinal, resposta objetiva, ataque, turno inimigo (fila circular,
escolha de ataque por cooldown, alvo aleatório, provocação, atordoamento), fim de rodada,
vitória/derrota, timers e `PlayerLeft`. Estrutura: `decide.ts` só despacha; `decide-context.ts`
acumula eventos dobrando cada um na hora e grava o PRNG num `PrngAdvanced` final;
`create-battle.ts`, `player-turn.ts`, `system-commands.ts`, `turn-cycle.ts`, `enemy-turn.ts`,
`questions.ts`, `stats.ts`, `strike.ts`, `actions/attack.ts`; `evolve.ts` cobre todos os eventos
(inclusive os do M6/M7) com os auxiliares em `evolve-units.ts`. Testes: `battle-flow.test.ts`
(cenários com números exatos) e `replay.test.ts` (200 sementes × 2 formações com o robô
determinístico de `fixtures/run-battle.ts`: toda batalha termina, todo estado é válido pelo
contrato e coerente — HP inteiro e no intervalo, caído ⇔ HP 0, vilão derrotado fora da fila —, o
replay do log reproduz o estado ao vivo, a mesma semente gera o mesmo log, o cursor do PRNG nunca
volta e avança; os dois desfechos e todos os caminhos de turno perdido aparecem). Ajustes:

- **Contrato**: `BattleContent` troca `skills` por `classes` (o `deriveStats` precisa da classe) e
  ganha `lineup` (o nó pode repetir vilão); `buildBattleContent(snapshot, nodeId)` já existe no
  motor (era tarefa do M3). `RoundEnded` diz quem fica bloqueado (`blocked`), então a rotação sai
  do log sem campo novo no estado; `TurnLost` ganhou o motivo `player_left`.
- **Regras escolhidas aqui**: com vários provocadores, o primeiro na ordem do elenco atrai o
  ataque; o cooldown de ataque de vilão conta também os turnos perdidos por atordoamento; um
  `PlayerLeft` fora da vez dele não muda o `turnToken` (presença não é estágio).
- **Fica para o M6**: os tiques de dano/cura contínuos (gancho marcado em `endGroupTurn`); a
  semântica do cooldown de habilidade — hoje ele decrementa no `RoundEnded` da própria rodada de
  uso, então "cooldown 2" espera só uma rodada cheia; decidir se o uso conta ou não; e o esquema de
  id de efeito (`fx-<token>-<índice>`), que precisa ser revisto quando efeitos forem aplicados em
  turnos inimigos.
- **Fica para o M7**: batalha com pergunta aberta só emite `QuestionRequested`; fallback e pausa
  pela presença do mestre ainda não existem.

Um arquivo por responsabilidade em `packages/battle-engine/src/`:

- [eu] Helper de teste `runBattle(content, roster, seed, script)` (veio do M0): aplica comandos via
  `decide` + `evolve` e devolve `{ state, log }`.
- [eu] `create-battle.ts`: `(content, roster, seed) → BattleStarted` (elenco, iniciativa por PRNG,
  baralho de perguntas, fila de inimigos).
- [eu] `stats.ts`: leituras efetivas (atributos, dano bruto da arma, defesa, vida máxima) sobre
  `stacking.ts`.
- [eu] `signal.ts` (elegibilidade/rotação — extrair de `decide.ts`), `questions.ts` (baralho,
  correção objetiva).
- [eu] `actions/attack.ts`, `enemy-turn.ts` (escolha de ataque, alvo, provocação, atordoar),
  `turn-cycle.ts` (fim de rodada, avanço group ↔ fila, vitória/derrota).
- [eu] `decide.ts` vira despachante fino; `evolve.ts` dividido por grupo de eventos se passar de
  ~150 linhas.
- Testes obrigatórios: iniciativa reproduzível por seed; fila circular com 3 vilões; rotação com
  bloqueio ignorado quando ninguém é elegível; erro passa a vez; vitória e derrota;
  **propriedade de replay**: para 200 seeds com um "jogador robô" determinístico,
  `replay(log) === estado ao vivo` e a batalha termina; HP nunca negativo, nunca `NaN`.

### M3 — Servidor e transporte (Etapa A)

**Status (2026-10-06): feito.** Batalha objetiva de ponta a ponta pelo servidor: formação, início,
comandos pelo socket, timers, gravação no perfil e descanso do mestre. Estrutura em `apps/server`:
`services/battle-registry.ts` (mapa em memória; `apply` síncrono; ouvintes `appended`/`removed`),
`battle-formation.ts` (regras de abrir/entrar/sair/cancelar), `battle-start.ts` (lê perfis e
versão, chama `createBattle`), `battle-timers.ts`, `battle-resolution.ts`, `plugins/battles.ts`,
`realtime/battle-channel.ts`, `routes/battles.ts`, `routes/room-rest.ts`, `mappers/battle.ts` e
`mappers/roster.ts`; no motor, `restoreAtCampfire` (`restore.ts`) e `profileOutcomes`
(`battle-outcome.ts`). `hasActiveBattle` virou `app.battles.hasActive`, passado a
`syncRoomVersion`/`readRoomDetail`; `RoomDetail.battles` vem do registro. Testes: `battles.test.ts`
(REST: recusas, limite, cancelar, guards, descanso), `battle-socket.test.ts` (vitória com dois
jogadores e canal sem lacuna de `seq`, write-back, varredura de segredos, ator pela sessão, sala
privada, `PlayerLeft` com duas abas e derrota do último, versão presa até o fim) e
`battle-timers.test.ts` (sinal expira; comando vence o timer e o timeout atrasado é
`stale_turn_token`). Escolhas e desvios:

- **Formação**: quem abre já entra; qualquer participante inicia; cancela o mestre ou o último
  participante que resta (na batalha rodando, o último que não saiu). `starting` trava a formação
  durante as leituras do início; perfil apagado no meio → `409 roster_changed`.
- **Pergunta aberta adiada inteira para o M7**: nó com pergunta aberta é recusado na abertura
  (`422 open_questions_unsupported`), senão a batalha travaria em `awaiting_question`. Por isso
  `master_offline`, "mestre não combate em nó com aberta" e o guard de transferir mestre também
  ficam para o M7. `masterOnline` já é lido da presença do lobby.
- **Saída**: fechar a última aba ou mandar `battle:leave` tira o jogador na hora — inclusive num
  recarregar de página (spec §7; tolerância de reconexão é Fase 6).
- **Desligar o servidor é um crash** (spec §3.7): o plugin de batalhas é registrado antes do
  realtime, e no `preClose` espera as gravações em andamento e esquece as batalhas antes de os
  sockets caírem — sem isso, um deploy gravaria todos como derrotados.
- **Para o M4**: cancelar uma batalha rodando não manda nada no canal; o cliente descobre pelo
  `room:changed` (ou por um `battle:closed` a criar). `buildApp({ battles: { timers, seed } })`
  existe para testes e para a semente fixa do e2e do M5.

- [eu] `services/battle-registry.ts`: `Map<battleId, ActiveBattle>` com `roomId`, `nodeId`,
  `campaignVersionId`, `content`, `state`, `log`, timers. `hasActiveBattle(roomId)` passa a
  consultá-lo (formação conta como ativa). Aplicação de comando **síncrona** (`decide` → append →
  `evolve` sem `await` no meio), o que serializa por batalha num processo só.
- [delegável] `battle-engine/src/content.ts`: `buildBattleContent(snapshot, nodeId)` (puro).
- [delegável] Rotas REST em `routes/battles.ts`: `POST /api/rooms/:roomId/battles { nodeId }`,
  `POST /api/battles/:id/participants` (entrar), `DELETE …/participants` (sair da formação),
  `POST /api/battles/:id/start`, `POST /api/battles/:id/cancel`. Todas emitem `room:changed`.
  Recusas: `participant_limit`, `node_busy`, `profile_downed`, `already_in_battle`,
  `master_offline` (decisão 1/2), `node_without_questions`.
- [eu] `realtime/battle-channel.ts`: `battle:join` (participante ou membro espectador),
  `battle:command` (Zod → preencher `profileId` pela sessão → registry → ack), broadcast de
  `battle:events` com `seq`, `battle:sync`. Desconexão do último socket do usuário na batalha →
  `PlayerLeft`.
- [eu] `services/battle-timers.ts` (decisão 8).
- [eu] `services/battle-resolution.ts`: write-back em transação com `lockRoom` (decisão 11),
  remoção do registry, `room:changed`; `restoreAtCampfire` puro em `battle-engine` +
  `POST /api/rooms/:id/rest` provisório.
- [delegável] Guards nas rotas da Fase 2: abandonar perfil (`409 in_battle`), encerrar sala
  (`battle_in_progress`, já existe), transferir mestre (decisão 1).
- Testes de integração (sockets em porta 0): batalha objetiva completa com dois usuários;
  comando com `turnToken` velho e de quem não é participante recusados; `profileId` forjado no
  payload ignorado; **publicar v2 durante a batalha não muda a versão da sala até o fim, e ela
  avança logo depois**; desconexão gera `PlayerLeft` e, se era o último, derrota; timer de sinal
  passa a vez; write-back de HP/energia/caído.

### M4 — Web, fatia vertical (Etapa A)

**Status (2026-10-06): feito.** Na sala, `features/battles/battles-section.tsx` lista os nós de
batalha da versão (`RoomDetail.battleNodes`, novo), as formações (`formation-card.tsx`: entrar,
sair, iniciar, cancelar, ir/assistir) e o "Descansar o grupo" do mestre; quem está numa formação
que começa é levado à batalha. A lista de membros mostra vida, energia e caído
(`RoomMember.profile` ganhou os recursos). A página `/rooms/[roomId]/battles/[battleId]`
(`battle-view.tsx`) junta cartões de inimigo e de grupo, o painel do turno (sinal, resposta
objetiva, alvo do ataque), o feed (`event-text.ts`, testado) e a tela de resultado.
`use-battle-channel.ts` entra pelo `battle:sync`, descarta lote duplicado, pede sync numa lacuna e
dobra com `evolvePublic` (novo no motor, `client-fold.ts`; o `replay.test.ts` prova em todas as
sementes que o fold do cliente a partir de qualquer sync chega à projeção pública do servidor).
`event-pacing.ts` pausa ~650 ms antes de cada troca de turno e ataque inimigo. Novos contratos:
`battle:closed { reason: resolved | cancelled }` (o servidor avisa o canal quando a batalha sai
do registro) e `BattleNodeOption`. E2E `e2e/battle.spec.ts`: um jogador forma, inicia, é levado à
batalha, toca o sinal, acerta, ataca, vê o dano e o turno inimigo; sai da página e perde (fica
caído); o descanso do mestre o reergue. Observações:

- **Sair da página tira o jogador** (spec §7): um clique em "Salas" no meio da batalha derruba quem
  luta sozinho. A página avisa; a tolerância de reconexão é da Fase 6 — reavaliar no playtest.
- **Sem contagem regressiva**: o contrato não leva o prazo dos timers ao cliente. Se o playtest
  pedir, `SignalOpened`/estágios ganham um `deadline` (aditivo).
- Cartão de vilão mostra só vida e "atordoado"; ícones de efeito com duração ficam para o M6.

- [delegável] Na sala: lista de nós `battle`/`boss` da versão (provisória), formações com
  entrar/sair/iniciar/cancelar, botão "descansar" do mestre.
- [delegável] Página `/rooms/[roomId]/battles/[battleId]`: hook `useBattleChannel` (socket,
  detecção de lacuna de `seq` → `battle:sync`), fold local com `evolve` do pacote, cartões de
  inimigo e de grupo com HP/energia/efeitos, botão do sinal com estado (bloqueado/elegível),
  pergunta objetiva, escolha de ação e alvo, feed de eventos, tela de resultado.
- [delegável] Fila de reprodução de eventos no cliente (só apresentação: atraso curto entre
  eventos para o turno inimigo ser legível). Nunca altera o estado, só o ritmo de exibição.

### M5 — E2E e playtest da fatia (fecha a Etapa A)

**Status (2026-10-06): e2e e seed feitos; falta o playtest com pessoas.** E2E
`e2e/battle-group.spec.ts`: dois usuários em contextos separados, sala pública, formação aberta
por um e completada pelo outro ao vivo, início levando os dois à batalha, rodadas com o sinal
alternando entre eles (rotação), vitória nas duas telas e, de volta à sala, a batalha some e o
dano fica no perfil. Semente fixa pela variável de teste `BATTLE_SEED` (opcional no `EnvSchema`,
ligada só no `playwright.config.ts`). Seed de playtest: `services/playtest-campaign.ts` (testado
contra o portão de publicação e abrindo cada batalha numa sala) + `pnpm --filter
@rpg-chains/server seed:playtest <e-mail>`; para isso a publicação e a importação do kit saíram
das rotas para `services/publish-campaign.ts` e `services/default-kit.ts`. Roteiro e simulação
de referência em [`phase-3-playtest.md`](phase-3-playtest.md).

- [delegável] Playwright: dois usuários, sala, formação, iniciar, responder certo, atacar, vencer
  um vilão fraco (fixture com seed fixa via variável de ambiente de teste) — é o e2e que a
  stack §6 pede.
- [delegável] Script de seed de playtest: campanha com o kit padrão e um capítulo de 3 batalhas.
- **Playtest com pessoas reais antes da Etapa B**: ritmo do sinal, duração dos timers, legibilidade
  do turno inimigo. Ajustes vão para `game-config`.

### M6 — Habilidades e catálogo de efeitos (Etapa B)

**Decisões tomadas antes de começar (2026-10-06, gravadas na spec §3.2, §3.3, §5.5):** a rodada de
aplicação de um efeito e a de uso de uma habilidade não contam (duração N = as N rodadas
seguintes; cooldown 3 usado na rodada 5 volta na 9); com o mestre presente, ele escolhe a pergunta
de cada turno (aberta do nó, escrita na hora ou objetiva sorteada), sem prazo; a resposta aberta
tem prazo próprio de 120 s (`BATTLE_TIMERS.openAnswerMs`).

**Status (2026-10-06): feito.** Motor: `effects/` (`magnitude.ts`, `targets.ts`,
`resolve-effect.ts` — os 13 tipos —, `dispel.ts`, `over-time.ts`), `actions/skill.ts`,
`actions/consumable.ts`, `skill-ready.ts`. Contrato: todo `ActiveEffect` guarda `appliedRound` (o
fim dessa rodada não conta nem tica); `Combatant.cooldowns` guarda a **rodada em que a habilidade
volta** (sem contagem regressiva); o combatente leva `skills` e `consumables` completos, para o
cliente exibir. A regra de alvos (`ALLOWED_TARGETS`) saiu do `campaign-rules` para o
`shared-types`, e o motor deixou de depender do `campaign-rules`. Ids de efeito seguem
`fx-<token>-<índice>`: só `ChooseAction` aplica efeito, e ele sempre muda o estágio, então o par é
único. Testes: `effects.test.ts` (um caso por tipo, números exatos, cooldown 2 usado na rodada 1
volta na 4, duração 3 cobre as 3 rodadas seguintes), `kit-scenarios.test.ts` (Golpe 19, Juízo
Final 75 → 97 com Fervor, Muralha 25% da vida) e a propriedade de replay com um robô que usa
habilidades (`skilledRobot`; o teste exige que as 13 do catálogo apareçam e os dois desfechos).
Web: escolha de habilidade/item com custo, recarga ("volta na rodada N") e alvo em segundo passo
(`action-targets.ts`, espelho do motor), selos de efeito com duração nos cartões, feed com
habilidades, efeitos e tiques. E2E: o Guardião usa Corrente de Ferro, atrai o ataque e a
habilidade aparece em recarga.

- [eu] `stacking.ts` refeito: modificadores de atributo coexistem (sem dedup), `netFlat`/`netPct`
  por stat; demais efeitos substituem por `kind` e reiniciam duração.
- [eu] `effects/resolve-effect.ts` + `effects/targets.ts`: um resolvedor por tipo dos 13, cada um
  com teste de fixture (incluindo os 3 que o kit não usa: restaurar energia, dissipar, redução de
  vida máxima). Casos de borda: escudo maior que o dano; redução de vida máxima cortando HP atual
  e expirando sem devolver HP; provocar convertendo área; atordoar pulando o turno do vilão
  certo na fila; dissipar removendo os N mais recentes; reerguer em alvo não caído (recusado).
- [eu] `actions/skill.ts` (energia, cooldown, nível de desbloqueio, alvo válido para o tipo —
  reusar `campaign-rules/src/effect-targets.ts` se a dependência continuar pura, senão mover a
  regra para `shared-types`) e `actions/consumable.ts` (mesmo resolvedor; inventário vazio na
  prática até a Fase 4).
- [eu] Testes de cenário com o kit: os números de exemplo do kit draft (Golpe ~19 no nível 1,
  Juízo Final 75 → 97 com Fervor, escudo de 30 do Guardião) viram asserções.
- [delegável] UI: barra de habilidades (custo, cooldown, bloqueio por nível/energia), seleção de
  alvo por tipo, ícones de efeitos ativos com duração.

### M7 — Mestre e perguntas abertas (Etapa C)

**Status (2026-10-06): feito.** Motor: `master-turn.ts` (`PresentQuestion` — pergunta do nó,
escrita na hora ou `{ draw: 'objective' }` —, `JudgeOpenAnswer`, `MasterPresenceChanged`),
`SubmitOpenAnswer` em `player-turn.ts`, e `openGroupQuestion` em `turn-cycle.ts` (mestre presente
→ `QuestionRequested`; ausente → objetivas do nó ou `BattlePaused`, sem inimigos agindo). Testes:
`master-turn.test.ts` e duas variantes novas da propriedade de replay com um mestre-robô que
escolhe, julga, sai e volta (uma delas só com abertas, para pausar). Servidor: mestre não entra em
formação com aberta (`409 master_cannot_fight`), precisa estar no lobby para iniciar
(`409 master_offline`), não pode transferir o papel (`409 battle_needs_master`); a presença do
lobby vira `MasterPresenceChanged` (`realtime/master-presence.ts`); `GET
/api/battles/:id/questions` dá ao mestre o banco do nó sem gabarito; resposta aberta usa
`openAnswerMs`. Web: painel do mestre (escolher/escrever/sortear, aprovar/reprovar), resposta
escrita do jogador, mestre levado à batalha que conduz. O canal da sala subiu para o layout de
`/rooms/[roomId]`, para o mestre não "cair" ao navegar da sala para a batalha. E2E
`battle-master.spec.ts`: mestre exibe a aberta, jogador responde, mestre aprova, jogador ataca.
Fica para depois: recarregar a página do mestre ainda o tira por um instante (cai para objetiva);
uma tolerância de reconexão é da Fase 6.

- [eu] `PresentQuestion`, `SubmitOpenAnswer`, `JudgeOpenAnswer` em `decide`; `needsMaster` no
  início; `MasterPresenceChanged` → fallback/pausa (decisão 2).
- [delegável] Painel do mestre na página da batalha: banco de perguntas abertas do nó, campo de
  pergunta ad hoc, resposta pendente com aprovar/reprovar, indicação de pausa.
- [eu] Testes: batalha aberta não inicia sem mestre online; mestre combatente recusado em nó com
  aberta (decisão 1); queda do mestre → objetivas do nó ou pausa; volta → retoma; julgamento
  por quem não é mestre recusado.
- [delegável] E2E curto: mestre julga uma resposta aberta.

## Ordem e paralelismo

M0 → M1 → **M2 e M3 em paralelo** depois que M1 fixar os contratos (M3 pode usar um `decide`
mínimo enquanto M2 completa) → M4 → M5 + playtest → M6 e M7 em paralelo (tocam arquivos
diferentes do motor; o ponto comum é `turn-cycle.ts`, que deve estar estável desde a Etapa A).

## Riscos

- **Determinismo quebrado em silêncio**: um `Date.now()`, iteração sobre `Map` sem ordem estável,
  ou número vindo do conteúdo em `evolve`. O teste de propriedade de replay (M2) é obrigatório e
  roda em CI; a regra "evolve não lê conteúdo" (decisão 3) é o que o mantém barato.
- **Vazamento de gabarito ou seed** pelo socket. Teste de varredura de payload (decisão 13).
- **Batalha travada**: qualquer estado sem saída (todos fora, ninguém elegível, mestre ausente
  com só abertas) precisa de teste que prove pausa, timer ou fim. O "jogador robô" do M2 ajuda.
- **Corrida entre comando e timer**: os dois passam pelo mesmo caminho síncrono e pelo
  `turnToken`; o primeiro vence, o segundo é `stale_turn_token`. Testar explicitamente.
- **Avanço de versão no meio da batalha**: `hasActiveBattle` precisa cobrir a formação também, ou
  a versão pode mudar entre formar e iniciar e o conteúdo da formação ficar velho.
- **Ritmo de jogo** é o risco de produto da fase (spec §8): por isso o playtest no fim da
  Etapa A, antes de investir no catálogo completo.
- **Crash perde a batalha** (aceito pela spec §3.7). Nada é gravado até o fim, então o perfil
  volta ao estado de antes da batalha — consistente, só custa tempo.
