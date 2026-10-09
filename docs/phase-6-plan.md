# Fase 6 — Robustez ao vivo: plano detalhado

_Escopo de [spec §8](spec.md): sincronização em tempo real, tratamento de desconexão, reinício
de batalha, garantia de que todo o estado de combate resida no servidor. Regras de domínio em
spec §3.2 (queda do mestre), §3.3 (elegíveis e tempo limite), §3.7 (derrota, estado em memória)
e §7 (queda de conexão)._

**Status (2026-10-08):** decisões 1–11 aprovadas como recomendadas ("pode começar"). M0–M6
feitos (Etapas A e B completas). O M7 (tempos do turno da campanha, decisão 12) foi **adiado de novo**
pelo usuário em 2026-10-08. Falta o M8 (homologação e playtest, decisão 13): a imagem única
(`Dockerfile`, `deploy/`) está pronta e testada localmente; o provedor está em escolha (o Fly.io
não tem mais plano gratuito).

## Objetivo e critério de pronto

Um jogador no celular luta uma batalha → troca de app para responder uma mensagem, a tela
apaga, o Wi-Fi vira 4G → volta em até um minuto e **continua na mesma batalha**, no mesmo
estado que os outros veem, sem ter caído e sem ter perdido nada. Recarregar a página, fechar e
reabrir a aba ou perder a rede por alguns segundos também não o tiram da luta; só sair de
propósito ("Sair da batalha") ou sumir por mais que o período de graça. O mestre que recarrega
a página não faz a batalha cair para as perguntas objetivas. Se o grupo inteiro cai, a batalha
**pausa** em vez de os inimigos baterem em ninguém. Se o **servidor** reinicia (deploy, `tsx
watch` salvando um arquivo no meio do playtest, crash), as batalhas em andamento **voltam do
ponto em que estavam** e os jogadores reconectam nelas; ofertas de troca pendentes também. O
mestre pode **reiniciar** uma batalha que deu errado. **A regra continua pura**: conexão e queda
viram fatos no log (como `MasterPresenceChanged`), o teste de replay com um robô que cai e volta
prova o determinismo, e um teste de servidor derruba o processo no meio de uma batalha, sobe
outro sobre o mesmo banco e prova que o fim é o mesmo de uma batalha sem queda.

## Levantamento (2026-10-08, sobre `develop`)

1. **`develop` = `main`**: o PR #1 (Fases 2–5) foi mergeado. A Fase 6 começa limpa.
2. **O que já existe e a Fase 6 usa:**
   - O cliente já se recupera de **lacuna** de eventos: cada lote tem `fromSeq..toSeq`, lote
     duplicado é descartado e lacuna pede `battle:sync` (`use-battle-channel.ts`). No `connect`
     (inclusive na reconexão automática do Socket.IO) ele refaz o `battle:join` e recebe um sync.
   - Comandos são idempotentes por `turnToken`: um comando que o Socket.IO reenvia depois de
     reconectar é `stale_turn_token`, não ação dupla.
   - Timers no servidor, regra no motor (`battle-timers.ts`); o relógio viaja como transporte.
   - `MasterPresenceChanged` e `BattlePaused { reason: 'master_absent' }` já são o modelo de
     "presença vira fato no log" e de "batalha pausada".
   - O cliente nunca recebe segredo (`toPublicState`/`toPublicEvent`) e o ator vem da sessão.
3. **O que quebra hoje:**
   - **Qualquer queda é saída definitiva.** O último socket do usuário sair do canal da batalha
     dispara `PlayerLeft` na hora (`battle-channel.ts`, `leave`), e `left` é permanente no motor.
     Recarregar a página, a aba do celular ir para segundo plano ou a rede piscar tiram o
     jogador da luta; se era o último, é **derrota** — com perda de ouro e rollback do capítulo.
   - O desmontar da página da batalha manda `battle:leave` (navegar dentro do app = sair).
   - **Dois sockets por aba**: o do lobby (no layout de `/rooms/[roomId]`) e o da batalha (na
     página). Cada um reconecta sozinho, sem estado comum.
   - **A queda do mestre é instantânea**: recarregar a página dele vira `MasterPresenceChanged`
     → objetivas ou pausa (nota do M7 da Fase 3).
   - **Lobby desatualizado depois de reconectar**: o `room:changed` perdido durante a queda não é
     recuperado; a sala só se atualiza na próxima mudança.
   - **Crash ou reinício perde batalhas** (spec §3.7, aceito até aqui) e **ofertas de troca**
     (Fase 4, "memória apenas"). Em dev, `tsx watch` reinicia o servidor a cada arquivo salvo.
   - **Batimento padrão do Socket.IO** (`pingInterval` 25 s + `pingTimeout` 20 s): um celular que
     some sem fechar a conexão leva até ~45 s para ser notado.
   - **Cancelar uma batalha rodando** é permitido ao último participante que não saiu
     (Fase 3 M3) — um jogador sozinho perdendo cancela e escapa da derrota.
4. **Sem CI** (`.github/workflows` não existe), apesar da stack §6. Fora do escopo desta fase
   (decisão 13), mas registrado.
5. **Pendência lembrada:** tempos do turno vindos da campanha (Fase 4 M6, adiada duas vezes) —
   decisão 12.

## Fora do escopo

- **Múltiplas instâncias do servidor / Redis** (stack §3.3): continua um processo só. O diário
  de batalha (decisão 6) não é um passo para isso — é para sobreviver a reinício.
- **"Connection state recovery" do Socket.IO**: duplicaria o nosso `seq` + `battle:sync`, e só
  funciona com o adapter em memória do mesmo processo (não sobrevive a reinício). Não usar.
- **Persistir formações** (batalha formando, ainda não iniciada): refazer é barato; perdem-se
  num reinício como hoje.
- **CI, monitoramento, backup do Postgres, load test** (stack §7): quando houver usuários reais.
- **Física × mágico, linhas na trilha, balão com o que falta**: fases próprias.

## Decisões de design

Cada uma tem uma recomendação e, quando faz sentido, uma alternativa. **(spec)** muda a spec.

1. **(spec §7, §3.3) Queda não é saída: período de graça.** Quando o último socket de um
   participante sai do canal **sem** pedir para sair, o servidor emite `PlayerDisconnected` e
   arma um prazo de `RECONNECT_GRACE_MS` (proposta: **60 s**, em `game-config`). Se ele volta
   antes, `PlayerReconnected`; se não, `PlayerLeft` como hoje (saída definitiva, sem recompensa,
   perde ouro na derrota). Enquanto desconectado:
   - **não é elegível para o sinal** (a spec §3.3 já diz "desconectados saem da lista de
     elegíveis") — o turno não espera por ele;
   - **continua alvo dos inimigos** e continua na batalha — senão cair seria uma esquiva;
   - **se o turno esperava por ele** (ganhou o sinal, ia responder ou agir), o timer do estágio
     continua correndo: volta a tempo e age, ou o turno é perdido como hoje.

   Conexão e queda **entram no log** (não são transporte): mudam quem é elegível, logo mudam o
   que `decide` faz, e o replay tem que reproduzir. Mesmo modelo do `MasterPresenceChanged`.
   Alternativa: graça só no servidor, sem evento (o jogador "continua conectado" para o motor
   até o prazo) — mais simples, mas o sinal fica esperando quem não pode tocar e o grupo não vê
   quem caiu.

2. **Sair de propósito continua imediato.** "Sair da batalha" (botão com confirmação na página)
   manda `battle:leave` → `PlayerLeft` na hora. **Desmontar a página não manda mais
   `battle:leave`**: navegar para a sala, fechar a aba ou recarregar é queda (graça), não saída.
   Na sala, quem está numa batalha rodando vê "Voltar à batalha" (já existe o `battleOf`).

3. **(spec §3.7) O grupo inteiro caiu → a batalha pausa.** Se não sobra nenhum participante
   que poderia agir (vivo e não saído) conectado — um caído assistindo não segura a batalha —, `BattlePaused { reason: 'all_disconnected' }`: nem o grupo nem os
   inimigos agem e nenhum timer corre. O primeiro que volta retoma (o turno do grupo reabre o
   sinal). Se o prazo de graça de todos vence, todos saem e vale a regra de hoje: abandono =
   derrota. Pausa no próximo ponto em que o turno do grupo abriria (no máximo uma ação inimiga
   depois da queda) — ou na hora, se o turno está no sinal. Alternativa: sem pausa — o grupo
   volta para um grupo massacrado por uma queda do roteador da casa.

4. **(spec §3.2) O mestre também tem graça.** A presença do mestre que o motor vê
   (`MasterPresenceChanged`) só vira `online: false` depois do mesmo `RECONNECT_GRACE_MS`; a
   lista de "online" do lobby continua instantânea (com "reconectando…"). Recarregar a página
   do mestre deixa de trocar a pergunta aberta por objetiva.

5. **Um socket por aba, com reconexão explícita.** O socket sobe para um provider no layout de
   `/rooms/[roomId]` e lobby e batalha o compartilham (`room:join` e `battle:join` no mesmo
   socket; o servidor já guarda `roomIds` e `battleIds` por socket). No `connect` o provider
   refaz os dois joins, **invalida as queries da sala** (recupera o `room:changed` perdido) e a
   batalha pede sync. A tela mostra "Reconectando…" e desabilita as ações enquanto
   desconectado (o `send` já recusa com `disconnected`). No celular, `visibilitychange` →
   visível força reconectar na hora em vez de esperar o backoff do Socket.IO. Batimento mais
   curto: `pingInterval` 10 s, `pingTimeout` 10 s (queda notada em ~20 s, não ~45 s).
   Alternativa: manter dois sockets e só corrigir cada um — mais duplicação de reconexão.

6. **(spec §3.7, CLAUDE.md) Batalhas sobrevivem ao reinício do servidor: diário de batalha.**
   Hoje "crash = o grupo recomeça" e não há tabela de batalha ativa — invariante do CLAUDE.md.
   A proposta é inverter isso com o mínimo:
   - Tabela `BattleJournal { battleId, roomId, nodeId, campaignVersionId, participants,
needsMaster, masterId, turnTimers, events jsonb[], updatedAt }`. **O conteúdo não é
     gravado**: `buildBattleContent(snapshot, nodeId)` o reconstrói da versão imutável (as
     perguntas escritas na hora já viajam no `SignalOpened`). O estado também não: é
     `replay(events)`.
   - Um listener do registro grava cada lote **depois** do `apply`, numa fila por batalha (as
     escritas da mesma batalha em ordem). `apply` continua síncrono: a trava por batalha não
     muda. Num crash perde-se no máximo o último lote ainda não gravado.
   - O write-back do fim **apaga o diário na mesma transação** — ou a batalha foi gravada nos
     perfis e o diário sumiu, ou nada aconteceu. Cancelar também apaga.
   - Na subida (`buildApp`), as batalhas do diário voltam ao registro com todos os
     participantes **desconectados** (graça a partir da subida, pausa da decisão 3) e o mestre
     ausente. Quem reconecta retoma. O relógio do estágio recomeça cheio.
   - **Ninguém volta depois de um reinício → cancelar, não derrotar**: a culpa foi do servidor.
     Só se alguém voltou e depois todos foram embora vale a derrota por abandono.
   - O `sync` ganha `epoch` (o momento em que a batalha subiu neste processo): o cliente que
     recebe um `epoch` novo aceita `seq` menor (o último lote perdido) e recomeça do sync.
   - Desligar o servidor (`preClose`) deixa de "esquecer" as batalhas: espera as escritas do
     diário e sai; elas voltam na subida.

   A spec §3.7 ("o estado de combate vive em memória e é perdível") e o CLAUDE.md
   ("deliberadamente não há tabela de batalha ativa") passam a dizer: **a memória é a fonte da
   verdade durante o processo; o diário é a cópia para voltar depois de um reinício**. O motor
   não muda — só ganha um teste. Alternativas: **(a)** manter como está (o crash custa refazer a
   batalha; em dev, cada arquivo salvo derruba o playtest); **(b)** gravar só no desligamento
   gracioso — cobre deploy, não crash, e não precisa de escrita por lote.

7. **Reinício de batalha pelo mestre.** "Reiniciar" (mestre, a qualquer momento) descarta a
   batalha rodando sem gravar nada — como cancelar — e abre na hora uma **formação nova no mesmo
   nó com os mesmos participantes que não saíram**, que qualquer um deles inicia. Serve para a
   batalha que travou, a pergunta aberta mal escrita, o jogador que caiu de vez. Sem mestre
   online, o grupo usa cancelar (decisão 8) e forma de novo.

8. **Cancelar uma batalha rodando deixa de ser fuga.** Hoje o último participante restante
   cancela sozinho e escapa da derrota. Proposta: numa batalha **rodando**, cancelar é do
   mestre; os jogadores só cancelam se o mestre estiver ausente **e** todos os participantes
   conectados pedirem (um pedido com confirmação de cada um, que expira em 30 s). Formação
   (não iniciada) continua como hoje. Alternativa: só o mestre cancela uma batalha rodando — um
   grupo sem mestre teria que lutar até o fim ou abandonar (derrota).

9. **Ofertas de troca persistidas.** `TradeOffer` vira tabela (`expiresAt` gravado); a expiração
   é lida na consulta (oferta vencida não existe) e o timer que avisa a sala é rearmado na
   subida. A regra de "uma oferta por par", o "nada se move até aceitar" e o `dropProfile`
   (entrar em batalha, sair da sala) continuam. Alternativa: deixar em memória — perder uma
   oferta custa propô-la de novo; nenhum item se perde.

10. **Auditoria: todo o estado de combate no servidor.** Conferir e travar com teste o que o
    cliente guarda: só o ritmo de exibição (`event-pacing.ts`), a abertura vista
    (`localStorage`), a resposta aberta sendo digitada e o alvo escolhido. Proposta: a resposta
    aberta em digitação vai para `sessionStorage` por `turnToken` (recarregar não apaga o que
    o jogador escrevia). Nenhuma regra é decidida no cliente (`action-targets.ts` só filtra a
    tela; o `decide` recusa o resto) — um teste de servidor manda o comando que a tela não
    deixaria e confere a recusa. Limite de comandos por socket (ex.: 20/s) contra cliente que
    martela o sinal.

11. **Testes de caos.** Três camadas, no espírito do `replay.test.ts`:
    - **motor**: o robô da propriedade de replay ganha cair/voltar em pontos aleatórios — replay
      = estado vivo, mesma semente = mesmo log, batalha sempre termina ou pausa (nunca trava);
    - **servidor**: sockets em porta 0 que caem e voltam no meio de cada estágio; e o teste de
      **reinício**: roda uma batalha com semente fixa, para o processo sem `close` gracioso no
      meio, sobe outro `buildApp` no mesmo banco, reconecta, termina — o fim (perfis, progresso)
      é igual ao de uma batalha sem queda com a mesma semente e os mesmos comandos;
    - **e2e** (Playwright): `context.setOffline(true)` no meio da batalha e volta; recarregar a
      página da batalha; o mestre recarregar com pergunta aberta.

12. **Tempos do turno vindos da campanha (pendência, adiada duas vezes).** A proposta continua a
    da Fase 4 M6: plataforma → campanha (autor, aditivo e opcional no snapshot, mudável como
    balanceamento) → ajuste do mestre; o tempo de escolher a ação só com o mestre. Encaixa aqui
    porque a fase já mexe nos timers (pausa, relógio que recomeça), mas não é robustez.
    Recomendação: **entrar como marco opcional no fim (M7)**, se você quiser; senão, adiar de
    novo.

13. **Ensaio em rede de verdade antes do playtest.** As quedas que importam acontecem no celular
    em 4G, e a LAN já escondeu dois bugs (lab note de 2026-10-08: `crypto.randomUUID`, URLs de
    upload). Recomendação: **um deploy de homologação** (Railway ou Fly.io, stack §4; um processo
    só, Postgres gerenciado, R2) — e aí conferir o cookie do Better Auth entre domínios no
    handshake do socket (risco aberto desde a Fase 2) e o `wss://`. Depende de você criar a conta
    no provedor. Alternativa: playtest na LAN com quedas provocadas (modo avião, trocar de
    Wi-Fi, recarregar) — cobre a lógica, não o cookie entre domínios nem a latência real.

## Mudanças de contrato (`shared-types`) e de schema

- `commands.ts` (sistema): `PlayerDisconnected { profileId }`, `PlayerReconnected { profileId }`.
- `events.ts`: os mesmos dois eventos; `BattlePaused.reason` ganha `'all_disconnected'`;
  `BattleResumed` se o retorno do mestre ainda não tiver um evento próprio (conferir no M1).
- `battle-state.ts`: `Combatant.connected: boolean` (público — o grupo vê quem caiu).
- `battle-realtime.ts`: `BattleClosedMessage.reason` ganha `'restarted'`
  (com o `battleId` da formação nova) — o cliente vai direto para ela.
- `battles.ts`: `POST /battles/:id/restart`; pedido de cancelamento
  (`POST /battles/:id/cancel-requests`, decisão 8); recusas `409 not_master`,
  `409 cancel_needs_everyone`.
- `game-config`: `RECONNECT_GRACE_MS`, `CANCEL_REQUEST_TIMEOUT_MS`.
- Prisma (migration `phase6_live_robustness`): `BattleJournal`, `TradeOffer`.
- Servidor: `pingInterval`/`pingTimeout` no `new Server(...)` (de `game-config` ou env).

## Marcos

`[eu]` = invariantes, determinismo, concorrência; `[delegável]` = mecânico, com contrato de tarefa.
Três etapas: **A** a queda não derruba (graça, pausa, socket único), **B** o servidor cai e volta
(diário, ofertas), **C** o grupo recomeça e joga numa rede de verdade (reinício, deploy, playtest).

### M0 — Decisões e spec

**Status (2026-10-08): feito.** Spec: §3.2 (graça do mestre), §3.3 (desconectado não é
elegível, mas é alvo), §3.7 (pausa do grupo desconectado; diário e reinício do servidor) e §7
(queda ≠ saída, período de graça, reiniciar e cancelar). **Ajuste ao plano:** o CLAUDE.md muda
junto com o código de cada marco (M2 graça, M4 diário), para nunca descrever o que ainda não
existe.

- [usuário] Aprovar as decisões 1–13 (em especial a 6, que inverte uma invariante, a 8, que tira
  um poder dos jogadores, a 12 e a 13).
- [eu] Reescrever na spec o que é **(spec)**: §3.2 (graça do mestre), §3.3 (desconectado não é
  elegível, mas é alvo), §3.7 (pausa com todos fora; diário de batalha; reinício do servidor
  cancela se ninguém volta), §7 (queda ≠ saída; período de graça; reiniciar batalha). No
  CLAUDE.md, a invariante "Runtime vs durable state" e a seção de batalhas passam a citar o
  diário.

### M1 — Motor: conexão como fato (Etapa A)

**Status (2026-10-08): feito.** `shared-types`: `Combatant.connected`, `PauseReasonSchema`
(`master_absent` | `all_disconnected`), comandos e eventos `PlayerDisconnected` /
`PlayerReconnected`. Motor: `canAct` em `signal.ts` (vivo, não saído, conectado) — a
elegibilidade e o fallback da rotação contam só quem está conectado; `system-commands.ts` ganhou
`playerDisconnected`/`playerReconnected`; `openGroupQuestion` pausa `all_disconnected` antes de
tudo, e `pauseIfNobodyCanAct` pausa na hora quando o turno está no sinal ou na escolha do mestre;
`PlayerLeft` também pode pausar. O mestre voltando só retoma a pausa `master_absent`. Testes:
`connection.test.ts` (11 — sinal, alvo, rotação, turno de quem caiu, pausa e retomada, caído
assistindo, saída definitiva, mestre e grupo fora juntos) e uma sexta variante da propriedade de
replay com o `connectionRobot` (cai a cada três rodadas, o grupo inteiro na rodada 6, quem
responde às vezes não volta a tempo), com a checagem de que todos esses caminhos acontecem.
Conferido com dois defeitos plantados (elegibilidade contando desconectados; sem pausa imediata):
os dois são pegos. Web: textos do feed e do painel de pausa para os eventos novos.
**Ajuste ao plano:** o motor também recusa **resposta e ação** de quem está desconectado
(`player_disconnected`), não só o sinal — quem caiu precisa voltar (o servidor aplica
`PlayerReconnected` no `battle:join`) antes de responder. `BattleResumed` não foi preciso: a
retomada é o `SignalOpened`/`QuestionRequested` que segue o `PlayerReconnected`.

- [eu] `PlayerDisconnected`/`PlayerReconnected` em `system-commands.ts`; `connected` no
  combatente; elegibilidade (`signal.ts`) exclui desconectados; pausa `all_disconnected` e
  retomada em `turn-cycle.ts`, reaproveitando o caminho da pausa do mestre; `evolvePublic` e
  `toPublicEvent` para os eventos novos.
- [eu] Testes de tabela: cair no sinal, na resposta, na ação, cair e voltar dentro do mesmo
  estágio, todos caírem (pausa) e um voltar (retoma), cair já caído (downed), sair depois de
  cair; robô da propriedade de replay que cai e volta (decisão 11), conferido com um defeito
  plantado (ex.: desconectado continuar elegível).

### M2 — Servidor: graça, mestre e saída explícita (Etapa A)

**Status (2026-10-08): feito.** `RECONNECT_GRACE_MS` (60 s) em `game-config`;
`services/grace-timers.ts` (`GraceTimers`, chaves por participante e por presença no lobby),
`app.grace` no plugin de batalhas (limpa quando a batalha sai do registro e no desligamento).
`battle-channel.ts`: o último socket do participante sair do canal é `PlayerDisconnected` + graça;
o `battle:join` cancela a graça e aplica `PlayerReconnected` **antes** do sync do ack; a graça
vencida é `PlayerLeft`. `DELETE /battles/:id/participants` numa batalha rodando é a saída de
propósito (`PlayerLeft` na hora). Lobby: a lista de online continua instantânea, mas quem sai entra
na graça e `app.lobbyPresent` (online **ou** na graça) é o que o jogo conta — a presença do mestre
nas batalhas (`master-presence.ts`) e o `master_offline` do início. Batimento do Socket.IO 10 s +
10 s. Testes: `battle-reconnect.test.ts` (9: volta na graça, graça vencida, duas abas, `battle:leave`
é queda, saída de propósito, estranho, grupo inteiro fora pausa e retoma, abandono, mestre
recarregando e mestre na graça iniciando batalha); o teste antigo de saída passou a sair por REST.
Testes de servidor com graça de 150 ms (`TEST_GRACE_MS`). Servidor 174, conferido com um defeito
plantado (queda = saída): 4 falham.
**Ajustes ao plano:** (1) a saída de propósito é **REST**, não `battle:leave` — o socket só
assina/desassina o canal, e desassinar é queda; (2) a graça do mestre virou graça de **qualquer**
presença no lobby: sem isso, um mestre recarregando a página não podia iniciar uma batalha que
precisa dele (a graça só existia com batalha já rodando). "Publicar com alguém desconectado não
rola a sala" já é garantido pelo `hasActive` (a batalha continua no registro) e não ganhou teste
próprio.

- [eu] `services/reconnect-grace.ts`: listener/serviço que, quando o último socket de um
  participante sai sem `battle:leave`, aplica `PlayerDisconnected` e arma o prazo; volta antes →
  `PlayerReconnected`; prazo → `PlayerLeft`. Prazos limpos quando a batalha sai do registro.
  `battle:leave` explícito continua `PlayerLeft` na hora. Toda checagem depois do último `await`
  (regra do registro).
- [eu] `master-presence.ts` com o mesmo prazo antes de `online: false` (decisão 4).
- [eu] `pingInterval`/`pingTimeout` (decisão 5).
- [eu] Testes (sockets em porta 0, timers curtos via `buildApp({ battles: { … } })`): cair e
  voltar no prazo não gera `PlayerLeft`; passar do prazo gera; duas abas, uma cai; mestre
  recarrega sem trocar a pergunta; todos caem → pausa → um volta → retoma; `battle:leave`
  continua imediato; publicar versão nova com alguém desconectado não rola a sala.

### M3 — Web: socket único e reconexão (fecha a Etapa A)

**Status (2026-10-08): feito.** `features/rooms/use-tab-socket.ts` cria o único socket da aba
(estado de conexão; volta para a aba visível → reconecta na hora); o `RoomChannelProvider` o
expõe (`useRoomSocket`) e mostra a faixa "Sem conexão — reconectando…"; `useRoomChannel` e
`useBattleChannel` usam esse socket, refazem o join em cada `connect` (a sala também é
re-buscada, recuperando o `room:changed` perdido) e, ao desmontar, só desassinam. Batalha:
ações desabilitadas sem conexão, selo "sem conexão" no cartão, botão "Sair da batalha" com
confirmação (REST), o aviso antigo trocado pelo prazo da graça, "Voltar à batalha" no cartão da
formação, rascunho da resposta aberta em `sessionStorage` por turno (`answer-draft.ts`). E2E novo
`battle-reconnect.spec.ts` (recarregar no meio da batalha e ir à sala e voltar continuam na mesma
batalha; sair pelo botão é derrota); `battle.spec` e `campaign-flow` agora perdem saindo pelo
botão. Suíte e2e verde.
**Ajuste ao plano:** o `epoch` no sync não foi preciso — o cliente já recomeça do sync a cada
join, e o join acontece a cada reconexão (inclusive depois de um reinício do servidor). Não usei
`setOffline` no e2e: o Chromium não derruba um WebSocket aberto de forma confiável; recarregar e
navegar exercitam o mesmo caminho (queda → graça → volta).

- [eu] Provider do socket no layout de `/rooms/[roomId]`; `useRoomChannel` e
  `useBattleChannel` passam a usá-lo; no `connect`, refazer joins, invalidar a sala e
  ressincronizar a batalha; `visibilitychange` (decisão 5).
- [delegável] Indicador "Reconectando…" e ações desabilitadas; selo "caiu — volta em 0:45" no
  cartão do combatente desconectado; aviso de pausa `all_disconnected`; botão "Sair da batalha"
  com confirmação (e o texto atual "Sair desta página tira você da batalha" sai); "Voltar à
  batalha" na sala.
- [delegável] Resposta aberta em digitação em `sessionStorage` por `turnToken` (decisão 10).
- [delegável] E2E: `setOffline` no meio da batalha e volta; recarregar a página da batalha;
  mestre recarrega com pergunta aberta.

### M4 — Diário de batalha (Etapa B)

**Status (2026-10-08): feito.** Migration `phase6_battle_journal` (`BattleJournal` com o cabeçalho
da batalha e `BattleJournalEntry` com um lote por linha, na posição do log). `BattleJournal`
(listener inscrito antes da resolução): grava cada lote numa fila por batalha, apaga o diário de
uma batalha cancelada; `idle()`/`settled()`. O write-back espera `idle()` e apaga o diário **na
mesma transação**. `registry.restore()` põe a batalha de volta sem avisar listeners;
`battle-restore.ts` (hook `onReady`, opção `restore`, desligada nos testes comuns) reconstrói o
conteúdo da versão, dobra o log, aplica `PlayerDisconnected` a todos (a batalha pausa) e arma a
graça de cada um e a do mestre; graça vencida sem ninguém de volta desde a subida → **cancela**;
batalha já resolvida e não gravada → refaz o write-back. Desligar o servidor espera o diário e
deixa as batalhas para a próxima subida. Testes: `battle-restart.test.ts` (desligar e subir de
novo → pausada → o grupo volta e vence; crash perdendo o último lote → ninguém volta → cancelada
sem perda de ouro nem nó concluído; resolvida e não gravada → gravada uma vez, e uma terceira
subida não grava de novo). Servidor 177; conferido com um defeito plantado (restaurar sem marcar
ausentes): 2 falham.
**Ajustes ao plano:** sem `epoch` (ver M3). O teste "o fim é igual ao de uma batalha sem queda" não
vale como escrito: a pausa e a retomada abrem uma pergunta nova do baralho, então o log diverge da
batalha sem queda; o teste prova o que importa — o log restaurado é o prefixo exato do anterior, o
replay do log final é o estado vivo, e o write-back acontece uma vez. Limite conhecido: a remoção
do diário pelo listener `removed` mascara, em teste, a remoção dentro da transação; o caso que só
ela cobre (crash entre o commit e a saída do registro) não tem teste determinístico.

- [eu] Migration `phase6_live_robustness` (`BattleJournal`); `services/battle-journal.ts`:
  listener que grava em fila por batalha; apaga no write-back (mesma transação) e no cancelar;
  `restore()` na subida (`buildApp`, depois do Prisma e antes de escutar) reconstrói conteúdo e
  estado, marca todos desconectados e arma a graça (decisão 6); `preClose` espera as escritas
  em vez de esquecer as batalhas.
- [eu] `epoch` no sync e o cliente aceitando `seq` menor num `epoch` novo.
- [eu] Teste de reinício (decisão 11): batalha com semente fixa, processo parado sem `close`,
  `buildApp` novo no mesmo banco, reconexão, fim igual ao da batalha sem queda; ninguém volta →
  cancelada sem perda de ouro; diário inexistente depois do write-back; batalha restaurada
  conta em `hasActive` (a sala não rola de versão por baixo dela).

### M5 — Ofertas, reinício e cancelamento (Etapas B e C)

**Status (2026-10-08): feito.** Ofertas: migration `phase6_trade_offers` (`TradeOffer`);
`TradeOfferStore` espelha cada proposta e remoção depois da mudança em memória (a memória continua
o índice que as rotas leem dentro das transações), e o plugin restaura as não vencidas no `onReady`
com o tempo que restava; desligar o servidor guarda as ofertas em vez de apagá-las. Reiniciar:
`POST /battles/:id/restart` (mestre) → `restartBattle` descarta a batalha e põe no lugar, sem
`await` no meio, uma formação no mesmo nó com quem não tinha saído; o canal recebe
`battle:closed { reason: 'restarted', next }`. Cancelar: numa batalha rodando, só o mestre
(`mayCancel`); sem ele, `POST /battles/:id/cancel-requests` junta os pedidos por 30 s
(`CANCEL_REQUEST_TIMEOUT_MS`) e cancela quando todos os conectados pediram (`409 master_present`
se ele está na sala ou na graça). Web: "Reiniciar" e "Cancelar" do mestre e "Pedir para cancelar"
no cartão da batalha, aviso de batalha reiniciada na página. Testes: `battle-control.test.ts` (5),
dois de ofertas em `trades.test.ts`, o teste antigo de "último participante cancela" virou o do
pedido; e2e de reconexão passa pelo "Reiniciar". Servidor 183.

- [delegável] `TradeOffer` em tabela (decisão 9), com os testes de troca existentes passando e
  um novo: oferta sobrevive ao reinício e expira no horário gravado.
- [eu] `POST /battles/:id/restart` (decisão 7): descarta, abre a formação com quem não saiu,
  `battle:closed { reason: 'restarted', next }`; a web leva os participantes à formação.
- [eu] Cancelamento de batalha rodando (decisão 8): mestre direto; pedido com confirmação de
  todos os conectados quando o mestre está ausente. [delegável] a UI do pedido.

### M6 — Auditoria e caos (fecha a Etapa B)

**Status (2026-10-08): feito.** `realtime/command-rate-limit.ts`: janela de 1 s, 20 intenções por
socket, além disso `rate_limited` antes de chegar ao registro. `battle-audit.test.ts` (7): responder
pelo vencedor do sinal, atacar alvo inexistente, habilidade inexistente e consumível que não tem
são recusados sem mexer na batalha; 30 toques seguidos → 10 cortados; queda e volta no sinal, na
resposta e na ação (de quem age e de outro) — o log tem exatamente um `PlayerDisconnected` e um
`PlayerReconnected` e a batalha termina em vitória com todos dentro. `turbo typecheck lint test`
verde (24 tarefas); servidor 190, motor 174; e2e 16/16.
**Ajuste ao plano:** a suíte de caos usa uma semente só (o app de teste tem semente fixa) e cobre
os estágios por tabela; a variação de sementes fica com a propriedade de replay do motor
(`connectionRobot`, 200 sementes).

- [eu] Teste "o cliente não decide nada": comandos que a tela não permitiria (alvo inválido,
  ação de outro, habilidade em cooldown, consumível que não tem) recusados pelo `decide`.
- [eu] Limite de comandos por socket (decisão 10), com teste.
- [delegável] Suíte de caos do servidor: queda e volta em cada estágio, por várias sementes.

### M7 — Tempos do turno da campanha (opcional, decisão 12)

**Status (2026-10-08): adiado** pelo usuário, de novo, para depois da Fase 6.

- [eu] `turnTimers` opcional na campanha (rascunho, snapshot aditivo, permitido pelo portão como
  balanceamento); a sala nasce com eles; o mestre ajusta por cima. [delegável] o formulário no
  editor da campanha.

### M8 — Homologação e playtest (Etapa C)

**Status (2026-10-08): pronto para o usuário.** Provedor: **Render, plano gratuito** (o Fly.io não
tem mais cota gratuita), banco no **Neon** (gratuito). Imagem única (`Dockerfile`,
`deploy/start.sh`, `deploy/Caddyfile`): Caddy na porta do host reparte `/api`, `/socket.io` e
`/health` para a API e o resto para a web, então página, cookie e socket ficam na mesma origem
(resolve o risco do cookie entre domínios); migrations na subida (o plano gratuito não tem passo de
release). `render.yaml` (Blueprint: Docker, Free, Virginia, uma instância, deploy automático
desligado). Conferido localmente com os limites do plano gratuito (`--memory=512m --cpus=0.1`,
`PORT=10000`): sobe em ~35 s, ~250 MB com uma batalha rodando, login, sala, trilha e batalha
funcionam, e `docker restart` no meio da batalha a traz de volta e a página reconecta sozinha.
Guia: [phase-6-playtest.md](phase-6-playtest.md). Falta o usuário criar as contas (Render, Neon),
fazer o push e jogar.

- [usuário] Conta no provedor (decisão 13). [eu] Deploy de um processo (servidor + web), Postgres
  gerenciado, R2; conferir cookie no handshake e `wss://`.
- Guia de playtest da Fase 6 (`phase-6-playtest.md`): roteiro de abuso de rede — modo avião por
  10 s e por 2 min, trocar de app no celular, recarregar no meio da resposta, fechar a aba do
  mestre com pergunta aberta, reiniciar o servidor no meio da batalha, o grupo inteiro sair.
  Perguntas: o período de graça é curto ou longo? a pausa com todos fora pareceu certa? alguém
  perdeu progresso sem entender? Números vão para `game-config`.

## Ordem e paralelismo

M0 → M1 → **M2 e M3 em paralelo** depois que o M1 fixar os eventos (o ponto comum é
`Combatant.connected`) → **M4 e M5 em paralelo** (diário × rotas de batalha/troca; o ponto comum
é o `battle:closed` e o write-back) → M6 → M7 (se aprovado) → M8.

## Riscos

- **Determinismo**: conexão entra no log; um `Date.now()` ou um prazo decidido dentro do motor
  quebraria o replay. O prazo de graça vive no servidor (como os timers); o motor só recebe o
  fato. O robô de replay que cai e volta é o guarda.
- **Graça como esquiva**: cair de propósito para não ser alvo — por isso o desconectado continua
  alvo. Cair para não ter que responder — o timer do estágio corre igual.
- **Pausa eterna**: com todos fora, a batalha pausada segura o nó e a versão da sala. O prazo de
  graça garante o fim (saída de todos → derrota, ou cancelamento depois de um reinício).
- **Diário fora de ordem ou atrasado**: escritas por batalha em fila; o write-back apaga o
  diário na mesma transação que grava os perfis. Um crash entre o fim da batalha e o write-back
  restaura uma batalha já resolvida — a restauração refaz o write-back em vez de reabrir a luta
  (testar).
- **Conteúdo reconstruído diferente**: só se o snapshot mudasse — e ele é imutável. Teste:
  conteúdo restaurado = conteúdo do início.
- **Dois sockets → um**: mexe no layout de todas as páginas da sala; o e2e inteiro tem que
  continuar verde (e a lab note de não rodar o e2e com `next dev` no ar vale).
- **Batimento curto** gasta mais rede no celular; 10 s/10 s é o meio-termo — o playtest diz.
- **Deploy sem downtime sobrepõe dois processos** (achado no M8): Render (e o Fly no modo
  padrão) sobe o processo novo antes de parar o antigo. O novo restaura do diário uma batalha que
  o antigo ainda joga: eles disputariam as linhas do diário, e um write-back poderia acontecer nos
  dois. Para o playtest: deploy só sem batalha rodando; reinício via Suspend/Resume. Correção
  futura, se houver deploy com gente jogando: um "dono" do diário no banco (lease com batimento),
  e a restauração esperando o dono anterior soltar.
- **Cookie entre domínios no deploy** (risco aberto da Fase 2): se o socket chegar sem sessão,
  o handshake recusa e o jogo inteiro para. Por isso a homologação vem antes do playtest.
