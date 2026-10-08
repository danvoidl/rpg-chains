# Fase 5 — Fluxo de capítulo: plano detalhado

_Escopo de [spec §8](spec.md): vídeos de abertura, desbloqueio por conclusão (inclusive do
chefe), fogueiras e snapshot, conclusão de campanha, histórico. Regras de domínio em spec §2.3
(grafo), §3.7 (derrota e fogueira), §7 (ciclo da sala) e §2.2.1 (o que a publicação permite)._

**Status (2026-10-08):** decisões 1–15, 17 e 18 aprovadas; a 16 (tempos do turno da campanha)
foi adiada para depois desta fase. A decisão 5 seguiu a opção (b): a derrota desfaz só o que o
grupo derrotado fez. O PR `develop` → `main` (Fases 2–4) será aberto pelo usuário mais tarde.

## Objetivo e critério de pronto

Uma sala nova abre no capítulo 1 com só a entrada liberada → o grupo vê a **trilha da campanha**
(uma coluna rolável, igual no celular e no computador) com o que está bloqueado, liberado e
concluído → assiste à abertura do capítulo e lê uma narrativa
→ vence uma batalha e os nós seguintes se abrem → acende uma fogueira, que cura todos e vira o
ponto de volta → perde uma batalha e volta à fogueira: os participantes são restaurados, perdem
ouro, e os nós vencidos depois da fogueira voltam a ficar abertos → vence todos os obrigatórios,
o chefe se abre sozinho → vencer o chefe conclui o capítulo e abre o próximo → o chefe do último
capítulo marca a sala como **concluída** → o mestre encerra e cada jogador vê a campanha no seu
**histórico**. A lista provisória de nós (`battleNodes`, `shopNodes`) e o descanso do mestre
saem. **As regras de progresso são funções puras**: um teste de propriedade com sequências
aleatórias de vitórias, derrotas e fogueiras prova que todo nó continua alcançável, que a derrota
nunca desfaz nada anterior à fogueira, e que o mesmo histórico de fatos dá sempre o mesmo mapa.

## Levantamento (2026-10-08, sobre `develop`)

1. **`develop` está 49 commits à frente de `main`** (Fases 2, 3 e 4). O PR estava previsto para o
   fim da Fase 4 e ainda não foi aberto.
2. **Verde:** `typecheck`, `lint` e `test` de todos os pacotes e do servidor passam (game-config 5,
   shared-types 19, campaign-rules 69, battle-engine 157, server 144 testes). A web não foi
   checada nesta rodada porque havia um `next dev` em `:3000` (lab note de 2026-10-06 M4).
3. **O que já existe e a Fase 5 usa:**
   - Nós com `prerequisites`, `mandatory`, `position` e arestas, editáveis no editor de grafo —
     **mas sem nenhum significado em jogo**: hoje nada lê `prerequisites` nem as arestas fora da
     validação (decisões 1–2).
   - `reachableNodeIds` e `isSinglePathNode` (`shared-types/graph.ts`); o portão de
     compatibilidade já recusa mudar entrada/chefe e tornar um nó inalcançável.
   - `restoreAtCampfire` (`battle-engine/restore.ts`), usado pelo descanso provisório do mestre.
   - `RoomStatus` já tem `'completed'`, nunca usado.
   - `History` é gravado no encerramento (`routes/room-master.ts`) e **nunca lido**: não há tela.
   - `narrative.videoUrl` é só um campo de URL; o upload (`routes/media.ts`) aceita só imagens.
   - `syncRoomVersion` só avança salas `open` — uma sala `completed` ficaria presa na versão.
4. **Provisórios marcados para a Fase 5:** `RoomDetail.battleNodes` e `.shopNodes`, `POST
/rooms/:id/rest` e o botão do mestre, `openFormation` sem gate de desbloqueio
   (`battle-formation.ts`), a loja aberta em qualquer nó (`routes/shops.ts`).
5. **Pendência lembrada (Fase 4 M6):** tempos do turno definidos pela campanha — adiada de novo
   (decisão 16).

## Fora do escopo

- **Editor do mapa de fundo** (subir a imagem e posicionar nós sobre ela): o contrato existe e
  continua (agora com largura fixa, decisão 17); esta fase só **mostra** o fundo ao jogador.
- **Linhas entre os nós na trilha do jogador** e **o balão dizer o que falta para liberar um
  nó** (decisão 13): ficam para depois; nesta fase o nó bloqueado só aparece bloqueado.
- **Vídeo sincronizado entre jogadores**: cada um assiste no próprio ritmo.
- **Reconexão numa batalha, ofertas e batalhas resistentes a queda** → Fase 6.
- **Tempos do turno vindos da campanha** (decisão 16) → depois desta fase.
- **Físico × mágico** (Fase 4 M6) → fase própria depois desta, se ainda fizer falta.
- **Reabrir sala encerrada, apagar histórico, "posição" do grupo no mapa**: o grupo não é um
  peão; cada um escolhe livremente entre os nós liberados (spec §2.3).

## Decisões de design

Cada uma tem uma recomendação e, quando faz sentido, uma alternativa.

1. **(spec §2.3) O progresso é da sala, guardado como fatos por nó.** Cada nó está **bloqueado**,
   **liberado** ou **concluído**; só "concluído" é gravado — liberado é sempre calculado. O que
   conclui cada tipo:
   - `battle` / `boss`: a vitória;
   - `narrative`: alguém da sala lê e toca em "Continuar" (decisão 12);
   - `shop`: a primeira vez que alguém a abre;
   - `campfire`: acender (decisão 4).

   Concluir é um fato da sala, não de um jogador: quem chega depois encontra o mapa como está.

2. **(spec §2.3) Regra de desbloqueio: arestas são caminho, pré-requisitos são trava** (aprovada). Um nó
   fica liberado quando:
   - **(a)** é a entrada de um capítulo alcançado, **ou** alguma aresta que chega nele vem de um
     nó concluído (OU — é isso que faz os ramos);
   - **e (b)** todos os seus `prerequisites` estão concluídos (E — a trava explícita do autor).

   **O chefe** precisa de (a) e (b) **e de todos os nós obrigatórios do capítulo concluídos** — é
   o "liberado automaticamente" da spec, sem ação do mestre. Obrigatório vale para qualquer tipo
   (uma narrativa obrigatória precisa ser lida), não só batalha: a spec diz "batalhas
   obrigatórias" e passa a dizer "nós obrigatórios". **O capítulo é concluído quando o chefe é
   vencido.** Alternativa para o chefe: E de todas as arestas que chegam nele (sem olhar
   `mandatory`) — mais fácil de explicar, mas deixa `mandatory` sem efeito.

3. **Batalha vencida fecha.** Um nó de batalha concluído não pode ser lutado de novo — não há
   farm de XP; o fator de relevância (spec §4.5) já cuida de quem chega atrasado. Só a volta à
   fogueira (decisão 5) reabre. Alternativa: refazer sem recompensa — dá treino, mas é mais um
   modo de batalha para testar.
4. **Fogueira: qualquer membro acende, sem limite de usos** (aprovada). Acender (alguém com perfil, fora de
   batalha) aplica `restoreAtCampfire` em **todos os perfis da sala que não estão em batalha**
   (como o descanso do mestre hoje) e torna aquela fogueira o **ponto de volta do capítulo**.
   Pode ser reacesa à vontade — o custo dela é ter que voltar até ela. Alternativa: só o mestre
   acende — mas o mestre pode estar ausente numa campanha só de perguntas objetivas.
5. **(spec §3.7) Derrota = voltar à última fogueira acesa, desfazendo só o que o grupo
   derrotado fez** (aprovada, opção b). No write-back da derrota, na mesma transação:
   - **os participantes** são restaurados como numa fogueira (vida e energia cheias, reerguidos)
     e perdem `DEFEAT_GOLD_LOSS_FRACTION` do ouro (já existe);
   - **voltam a não concluídos só os nós do capítulo da batalha concluídos depois que a fogueira
     foi acesa e em que algum participante da batalha perdida tomou parte** — batalhas que ele
     lutou, e lojas, narrativas que ele abriu ou concluiu. O que outro subgrupo concluiu sem
     nenhum deles fica concluído; a fogueira continua acesa; nada antes dela e nada de outro
     capítulo muda;
   - **sem fogueira acesa no capítulo, o ponto de volta é a entrada** (o autor controla isso
     pondo fogueiras);
   - **um nó concluído continua concluído mesmo que o nó que o liberou volte**: se B perde e B1
     volta, um nó que só B1 liberava volta a ficar bloqueado — mas, se o subgrupo A já o tinha
     vencido, ele fica vencido, e uma batalha de A que esteja rodando nele termina e conta
     normalmente;
   - nó com batalha formando ou rodando não é tocado; quem não lutou não é restaurado.

   Exemplo: depois da fogueira F, A vence A1 e A2 num ramo, B vence B1 no outro e perde em B2 →
   só B1 reabre. Nível, XP, ouro ganho, equipamento e inventário nunca regridem. Alternativas
   descartadas: (a) desfazer tudo do capítulo depois da fogueira — pune quem não perdeu; (c) não
   desfazer nada — a derrota quase não custa.

6. **Capítulos em sequência; os passados continuam abertos.** O próximo capítulo é alcançado
   quando o chefe do anterior é vencido. Num capítulo concluído, lojas e fogueiras continuam
   usáveis e batalhas opcionais não feitas continuam jogáveis (a derrota nelas volta à fogueira
   **daquele** capítulo, decisão 5). Alternativa: capítulo concluído congela — menos estados, mas
   perde conteúdo opcional.
7. **(spec §2.2.1) A ordem dos capítulos publicados é fixa; capítulo novo entra só no fim.** O
   portão de compatibilidade ganha `chapter_order_changed` (reordenar os já publicados ou publicar
   um capítulo antes deles). Sem isso, uma sala que já passou do capítulo 2 "voltaria" a um
   capítulo inserido antes. Pelo mesmo motivo, **um capítulo em construção só pode ficar depois
   de todos os publicados** (validação `chapter_under_construction_not_last`, decisão 18). Conclusões são fatos: um nó obrigatório novo num capítulo já concluído
   não o reabre; um pré-requisito novo pode travar um nó ainda não concluído (é escolha do autor,
   e a decisão 8 garante que ele continua alcançável).
8. **Portão de validação: todo nó tem que poder ser liberado.** `node_never_unlocks` — simula o
   mapa concluindo tudo o que se libera até não mudar mais; sobrou nó bloqueado (pré-requisito que
   vem depois dele no caminho, ciclo entre pré-requisitos), a publicação falha. `draftWarnings`
   ganha `chapter_without_campfire` (capítulo com batalhas e nenhuma fogueira: a derrota volta à
   entrada).
9. **(spec §7) Conclusão da campanha.** Vencer o chefe do último capítulo da versão marca a sala
   `completed` (`completedAt`). A sala concluída **continua jogável** (lojas, trocas, opcionais)
   até o mestre encerrar. Se a sala rola para uma versão com um capítulo novo, ela volta a `open`
   — `syncRoomVersion` passa a avançar também salas `completed`.
10. **Histórico com tela.** O encerramento (já existe) passa a gravar também `completed` e os
    capítulos concluídos em `finalData`. Nova página "Histórico" (`GET /api/history`): as
    campanhas encerradas do usuário, com classe, nível, atributos, equipamento e ouro dele (é o
    próprio histórico, então o ouro privado aparece). A sala encerrada continua só leitura.
11. **Abertura de capítulo e vídeo.** O capítulo ganha `opening: { text, videoUrl? }`, opcional e
    aditivo no snapshot (texto e arte: mudar é permitido). Cada jogador vê a abertura ao entrar no
    capítulo pela primeira vez (marca local no navegador, nada no servidor) e pode reassistir. A
    abertura da campanha é a do capítulo 1. Vídeo: o presign aceita `video/mp4` e `video/webm`
    com teto próprio (`MEDIA_MAX_VIDEO_BYTES`, env), e o campo continua aceitando URL externa.
    Alternativa: só URL externa — sem upload, mas o autor depende de outro serviço.
12. **Narrativa: quem abre lê; qualquer um conclui.** Abrir mostra o texto e o vídeo só a quem
    abriu; "Continuar" (qualquer membro com perfil) conclui o nó para a sala. Alternativa: só o
    mestre conclui — mais controle de ritmo, mas trava a sala sem ele.
13. **Trilha do jogador, no estilo Duolingo.** A sala mostra **uma coluna estreita, de largura
    fixa, que só cresce para baixo**, igual no celular e no computador: no celular ela ocupa a
    largura da tela; no computador é a mesma coluna centralizada, e as laterais ficam para a
    ficha, as trocas e os membros. Sem zoom e sem arrastar para os lados — só rolagem vertical.
    - **Todos os capítulos numa rolagem só**, cada um com um cabeçalho (nome + botão da abertura,
      decisão 11) e um divisor entre eles. Os concluídos ficam acima, o atual é rolado para a
      vista ao abrir a sala, os bloqueados aparecem em cinza abaixo e os em construção no fim
      (decisão 18).
    - Os nós ficam nas posições do autor (nunca normalizadas — invariante do CLAUDE.md), e
      vários podem ficar na mesma altura: é assim que aparecem ramos e trechos horizontais.
    - **Sem linhas entre os nós.** As arestas continuam valendo para o desbloqueio (decisão 2),
      mas não são desenhadas; o estado de cada nó (bloqueado / liberado / concluído / batalha em
      andamento / fogueira acesa) é o que guia o jogador.
    - Tocar num nó abre um **balão** com o nome e a ação do tipo — "Formar batalha · nível 3 ·
      2/4 vagas", "Entrar", "Abrir loja", "Acender", "Ler".
    - Componente próprio (posições absolutas numa coluna), não o `@xyflow/react`: não precisa de
      zoom, arrastar nem arestas. Substitui `battleNodes` e `shopNodes`.

14. **Dados: fatos por nó + sequência da sala.** `RoomNodeClear { roomId, chapterId, nodeId,
seq, profileIds }` (único por sala e nó; `profileIds` = quem tomou parte — os participantes da
    batalha, ou quem abriu a loja / continuou a narrativa / acendeu a fogueira — para a derrota saber
    o que desfazer, decisão 5) e `RoomChapterState { roomId, chapterId, campfireNodeId?,
campfireSeq?, clearedAt? }`; `Room.progressSeq` (contador) e `Room.completedAt`. A sequência,
    não o relógio, ordena "depois da fogueira". Toda escrita de progresso roda sob `lockRoom`; a da
    batalha, dentro da transação do write-back. Alternativa: um jsonb `progress` na sala — menos
    tabelas, mas sem consulta nem unicidade.
15. **As regras são puras e compartilhadas.** `campaign-rules/src/progress/`:
    `chapterProgress(snapshot, facts) → ChapterProgressView[]`, `canEnter(view, nodeId)`,
    `rollbackToCampfire(facts, chapterId, defeatedProfileIds) → facts`, `clearsChapter`, `completesCampaign`. O
    servidor só lê fatos, chama e grava; a web pode usar as mesmas funções (já depende de
    `campaign-rules`). Nada disso vai para o `battle-engine`: não é combate.
16. **Tempos do turno vindos da campanha: adiada** (2026-10-08). A proposta continua a da Fase 4
    M6 — plataforma → campanha → ajuste do mestre, com o tempo de escolher a ação só com o mestre
    — e volta a ser discutida depois desta fase.

17. **A trilha tem largura fixa e uma grade de 5 colunas** (aprovada). Todo capítulo usa o mesmo
    mundo de largura `TRAIL_WIDTH` (proposta: 400) e altura livre; o editor encaixa cada nó numa
    grade de `TRAIL_COLUMNS = 5` colunas e linhas de `TRAIL_ROW_HEIGHT`, para baixo à vontade.
    Cinco colunas cabem com folga num celular de 360px e permitem até 3 ramos lado a lado com
    espaço entre eles; a grade garante o espaço mínimo de toque, então o problema do celular é
    evitado no editor, não avisado depois. A posição continua em pixels absolutos do mundo (o
    contrato não muda de forma); o portão de validação recusa nó fora da grade (`node_off_grid`).
    O mapa de fundo passa a ter a largura da trilha (um "pergaminho" de altura livre), e a trilha
    é desenhada na mesma escala dele, então o nó continua preso ao ponto do desenho. As
    constantes ficam em `shared-types` (editor, validação e trilha usam as mesmas), não no
    `game-config`: são de interface, não de balanceamento. O editor passa a mostrar a coluna com a
    grade — o autor vê exatamente o que o jogador verá.
18. **(spec §2.2) Capítulos em construção aparecem no fim da trilha.** Hoje eles não entram no
    snapshot. Passam a entrar só como **esboço** — `upcomingChapters: [{ id, name }]`, aditivo e
    sem conteúdo — para a trilha mostrar "Em construção" em cinza depois dos capítulos
    publicados. Quando o autor publica o capítulo, o esboço vira capítulo e as salas o recebem ao
    rolar a versão. Como capítulo novo só entra no fim (decisão 7), o em construção também precisa
    estar depois de todos os publicados; publicar um capítulo que vem depois de um em construção
    é recusado (`chapter_under_construction_not_last`). O esboço não é referenciável: o portão de
    compatibilidade não o trata como capítulo publicado.

## Mudanças de contrato (`shared-types`) e de schema

- `content.ts`: `ChapterSchema.opening` (opcional).
- `trail.ts` (novo): `TRAIL_WIDTH`, `TRAIL_COLUMNS`, `TRAIL_ROW_HEIGHT` e as funções de encaixe
  (`snapToTrail`, `isOnTrailGrid`), usadas pelo editor, pela validação e pela trilha.
- `snapshot.ts`: `upcomingChapters: [{ id, name }]` (padrão `[]`, decisão 18).
- `progress.ts` (novo): `NodeStateSchema` (`locked` | `unlocked` | `cleared`),
  `ChapterProgressViewSchema { chapterId, name, opening, background, state: locked | current |
cleared, campfireNodeId, nodes: [{ nodeId, type, title, position, mandatory, state,
recommendedLevel, participantLimit, needsMaster, battleId? }], edges }`, e os payloads
  `CampfireInput`, `NarrativeContinueInput`.
- `rooms.ts`: `RoomDetail` perde `battleNodes`/`shopNodes`, ganha `chapters:
ChapterProgressView[]` e `completedAt`.
- `history.ts` (novo): `HistoryEntrySchema` e a lista.
- `battles.ts`: `BattleNodeOptionSchema` sai (vira parte da view do capítulo).
- Recusas novas: `409 node_locked`, `409 node_cleared` (formar batalha, abrir loja, acender,
  continuar narrativa).
- `campaign-rules`: `node_never_unlocks`, `node_off_grid`, `background_width_mismatch` e
  `chapter_under_construction_not_last` (validação), `chapter_order_changed` (compatibilidade),
  `chapter_without_campfire` (aviso).
- Prisma (migration `phase5_chapter_flow`): `Chapter.openingText`, `Chapter.openingVideoUrl`;
  `RoomNodeClear`, `RoomChapterState`; `Room.progressSeq Int @default(0)`, `Room.completedAt`.
- Env: `MEDIA_MAX_VIDEO_BYTES` (`env-schema.ts` + `.env.example`).

## Marcos

`[eu]` = invariantes, determinismo, concorrência; `[delegável]` = mecânico, com contrato de tarefa.
Três etapas: **A** o mapa anda (desbloqueio, fogueira, derrota), **B** o capítulo conta uma
história (abertura, narrativa, vídeo), **C** a campanha termina (conclusão, histórico).

### M0 — Pré-requisitos e decisões

**Status (2026-10-08): feito.** Decisões aprovadas. Spec reescrita: §2.2 (capítulo em
construção leva só o nome e fica depois dos publicados), §2.2.1 (capítulo novo só no fim;
reordenar é proibido), §2.3 (progresso da sala, regra de desbloqueio, chefe e obrigatórios de
qualquer tipo, capítulos, fogueira, trilha, abertura, fundo com a largura da trilha), §3.7
(derrota desfaz só o que o grupo derrotado fez) e §7 (sala concluída continua jogável e reabre
com capítulo novo; histórico do jogador). O PR fica com o usuário, para depois.

- [usuário] PR `develop` → `main` com as Fases 2–4 — mais tarde.
- [eu] Reescrever na spec o que é **(spec)**.

### M1 — Regras puras e contratos (Etapa A)

**Status (2026-10-08): feito.** `campaign-rules/src/progress/`: `unlock.ts` (`isNodeUnlocked`,
`neverUnlockingNodes`), `room-progress.ts` (os fatos: `clears` com `seq` e `profileIds`,
`campfires`, `clearedChapterIds`, `EMPTY_PROGRESS`), `node-state.ts`, `progress-view.ts`
(`campaignProgress` → `CampaignProgressView`), `node-entry.ts` (`checkNodeEntry`: `node_locked`,
`node_cleared`, `wrong_node_type`, `node_not_found`) e `record-progress.ts` (`recordNodeCleared`,
`recordCampfireLit`, `rollbackDefeat`). `shared-types`: `trail.ts` (largura 400, 5 colunas de 80,
linhas de 100; `snapToTrail`, `isOnTrailGrid`), `progress.ts`, `history.ts`,
`ChapterSchema.opening` e `upcomingChapters` (aditivos; snapshot antigo continua válido).
Publicação: `node_never_unlocks` (ignora pré-requisito desconhecido, que já é
`missing_reference`), `chapter_under_construction_not_last`, `upcomingChapters` no snapshot e
`chapter_order_changed` na compatibilidade; mensagens em português na web. Testes: 26 no
`progress/` — incluindo a propriedade de 200 seeds × 80 jogadas (alcançável até o fim, rollback
só no capítulo, depois da fogueira e com quem perdeu, chefe vencido nunca volta, mesmas jogadas =
mesmo progresso), conferida com dois defeitos plantados na regra da derrota, que ela pegou.
**Ajuste ao plano:** `node_off_grid`, `background_width_mismatch` e o aviso
`chapter_without_campfire` foram para o M4, junto do editor — recusar nó fora da grade antes de o
editor encaixar quebraria o fluxo de autoria, e o aviso não tem faixa numérica (o formato dos
`draftWarnings` atuais) nem mensagem até o editor existir.

- [eu] `progress/` em `campaign-rules` (decisões 1–7, 15), com testes de tabela: OU das arestas,
  E dos pré-requisitos, chefe esperando obrigatórios, batalha fechada, capítulo seguinte,
  rollback com e sem fogueira, rollback que não atravessa capítulo, rollback que só desfaz os
  nós de quem perdeu, nó concluído que continua concluído quando o que o liberou volta.
- [eu] Teste de propriedade (como o `replay.test.ts`): 200 seeds, sequências aleatórias de
  concluir / acender / perder — todo nó continua alcançável, nada antes da fogueira some, mesmo
  histórico = mesmo mapa.
- [eu] `progress.ts`, `history.ts`, `trail.ts`, `opening` e `upcomingChapters` em
  `shared-types`; `node_never_unlocks`, `node_off_grid`, `background_width_mismatch`,
  `chapter_under_construction_not_last`, `chapter_order_changed` e `chapter_without_campfire` em
  `campaign-rules`, com o teste de que snapshots antigos continuam válidos.

### M2 — Servidor do mapa (fecha a Etapa A)

**Status (2026-10-08): feito.** Migration `phase5_chapter_flow` (`RoomNodeClear`,
`RoomChapterState`, `Room.progressSeq`, `Room.completedAt`). `services/room-progress.ts`
(`loadProgress`, `changeProgress` — aplica uma regra pura e grava a diferença — e
`syncCompletion`). Trava: formar batalha recusa `409 node_locked`/`node_cleared`; a loja recusa
`node_locked` e a primeira abertura a conclui. Rotas novas: `POST /rooms/:id/campfires/:nodeId`
(restaura quem não está em batalha e vira o ponto de volta) e `POST
/rooms/:id/narratives/:nodeId/continue`. Write-back (`battle-resolution.ts`): a vitória conclui o
nó (com os participantes), o chefe conclui o capítulo e o último completa a sala; a derrota
desfaz o que os derrotados fizeram depois da fogueira — e, no motor, `settleProfile` passou a
devolver os derrotados restaurados (spec §3.7). `RoomDetail.progress` (a trilha, com o
`battleId` de cada nó sobreposto) e `completedAt`; `syncRoomVersion` avança também salas
`completed` e as reabre com capítulo novo; sala concluída aparece na lista pública e aceita
jogador novo. A fixture de batalha ganhou a narrativa de entrada `n-gate` e o helper `clearGate`.
Testes: `room-progress.test.ts` (trava, vitória, derrota com e sem fogueira, conclusão e
reabertura, derrota × vitória nas duas ordens — conferido desligando o rollback: 4 falham),
`campfires.test.ts`, `narratives.test.ts`, `shops.test.ts`; o teste do playtest agora libera
cada batalha antes de abri-la. Rotas de fogueira/narrativa e a trava da loja foram feitas por
agentes Sonnet, revisadas.
**Ajustes ao plano:** `battleNodes`/`shopNodes` continuam no `RoomDetail`, mas só com os nós
liberados, e o `POST /rest` continua — os dois saem no M3 junto com a web, para a web atual não
quebrar no meio. **Até o M3 o e2e de batalha não passa**: a entrada do seed é uma narrativa, e a
web ainda não tem como continuá-la.

- [eu] Migration e `services/room-progress.ts` (lê fatos, chama as regras, grava sob `lockRoom`).
- [eu] Gates: `openFormation` e a loja recusam `node_locked`/`node_cleared`. Rotas novas:
  `POST /rooms/:id/campfires/:nodeId` (acender) e `POST /rooms/:id/narratives/:nodeId/continue`;
  ambas emitem `roomEvents.changed`.
- [eu] Write-back: vitória conclui o nó; chefe conclui o capítulo; último chefe → `completed`;
  derrota → restaura os participantes + rollback (decisão 5). Tudo na transação que já existe.
- [eu] `RoomDetail.chapters`; `syncRoomVersion` também para `completed` (e reabre com capítulo
  novo). Sai `POST /rest`.
- [eu] Testes de servidor: batalha bloqueada recusada; vitória libera os seguintes; chefe só
  depois dos obrigatórios; fogueira cura quem não está em batalha; derrota volta à fogueira
  e desfaz só os nós do subgrupo derrotado, enquanto outra batalha do mesmo capítulo é vencida
  (as duas ordens); duas fogueiras acesas ao
  mesmo tempo; sala concluída rola para versão com capítulo novo e reabre.

### M3 — Web do mapa (Etapa A, jogável)

**Status (2026-10-08): feito.** `features/trail/`: `campaign-trail.tsx` (todos os capítulos numa
rolagem, o atual rolado para a vista, os em construção no fim, "Campanha concluída"),
`chapter-trail.tsx` (cabeçalho e o mundo escalado à coluna por `aspect-ratio`, fundo na largura da
trilha), `trail-node.tsx` (estado por cor e selo: bloqueado, liberado, concluído, batalha em
andamento, fogueira acesa) e `node-balloon.tsx` (formar batalha, abrir loja, acender/reacender,
continuar a narrativa; fecha ao tocar fora e depois da ação), com `trail-geometry.ts` e
`node-label.ts` testados. Saíram `battleNodes`, `shopNodes`, `BattleNodeOptionSchema`,
`ShopNodeOptionSchema`, `POST /rest`, o botão do mestre e as listas provisórias. Fim de batalha
(agente Sonnet, revisado): a derrota diz para qual fogueira o grupo voltou e o que reabriu; o
chefe diz "Capítulo concluído!" ou "Campanha concluída!". O e2e passa pela narrativa de entrada e
confere o rollback (a derrota sem fogueira desfaz a narrativa e trava a batalha de novo): 14/14.
Conferido no navegador em 375px e no desktop.
**Ajustes ao plano:** no computador a sala ficou com **duas colunas** (trilha + uma lateral com
ficha, membros, trocas e mestre), não três — com três, a ficha ficava espremida. O seed de
playtest foi para a grade já aqui (estava no M4), para dar para ver a trilha.

- [eu] Componente da trilha (decisão 13): coluna de largura fixa escalada para a tela, nós nas
  posições do autor, estados, cabeçalho e divisor por capítulo, capítulos bloqueados e em
  construção em cinza, rolagem até o capítulo atual. Conferido em 360px, 768px e desktop.
- [eu] Vindo do M2: tirar `battleNodes`, `shopNodes` e `BattleNodeOptionSchema` do contrato, o
  `POST /rest` e o botão do mestre; e2e de batalha passando pela narrativa de entrada.
- [delegável] Balão do nó com a ação (formar/entrar na batalha, abrir loja, acender fogueira,
  ler narrativa) e o layout da sala no computador (trilha ao centro, ficha/trocas/membros nas
  laterais). Sai a lista provisória e o botão de descanso do mestre.
- [delegável] Fim de batalha: na derrota, "o grupo voltou à fogueira X" e os nós que reabriram;
  na vitória do chefe, "capítulo concluído".

### M4 — Abertura, narrativa e vídeo (Etapa B)

**Status (2026-10-08): feito.** Abertura do capítulo: `Chapter.openingText`/`openingVideoUrl`
(migration `phase5_chapter_opening`), `DraftChapter.opening`, `opening` no `PATCH` do capítulo e no
snapshot (vazia = sem abertura). Presign aceita `video/mp4` e `video/webm` com teto próprio
(`MEDIA_MAX_VIDEO_BYTES`, 50 MB no `.env.example`). Portão: `node_off_grid`,
`background_width_mismatch`; aviso `chapter_without_campfire` (cabe no formato numérico: valor = 0
fogueiras, faixa mínima 1). Editor na grade: o canvas mostra a coluna de `TRAIL_WIDTH` com as
células, o nó tem o tamanho de uma célula, arrastar encaixa (`snapGrid`) e não sai da coluna,
soltar numa célula ocupada devolve o nó (`grid-placement.ts`, testado), nó novo entra na coluna do
meio abaixo do último, e o botão "Encaixar na grade" aparece quando há nó fora dela (capítulos
desenhados antes da trilha). `GET /rooms/:id/narratives/:nodeId` e a página da narrativa ("Ler" no
balão → texto e vídeo → "Continuar"); abertura mostrada uma vez por capítulo (marca no
`localStorage`) e "Ver abertura" no cabeçalho do capítulo. Agentes Sonnet fizeram o formulário da
abertura (na lista de capítulos), o upload de vídeo (`components/video-upload.tsx`, também no nó
narrativo), as mensagens, a página da narrativa e a abertura do jogador — revisados. Conferido no
navegador: encaixe, recusa de célula ocupada, abertura e narrativa; e2e 14/14 (agora passando pela página da narrativa).
**Ajustes ao plano:** o seed de playtest ganhou uma fogueira (ramo com a loja) por causa do aviso;
a abertura aparece sozinha só para quem tem personagem (o mestre usa "Ver abertura"). O upload
real de vídeo para o S3 não foi testado no navegador — o presign tem teste de servidor.

- [eu] Presign de vídeo com teto próprio (decisão 11); `opening` no rascunho, no mapeamento
  rascunho → snapshot e no `PUT` do capítulo.
- [eu] Editor de capítulo na trilha (decisão 17): o canvas vira a coluna de `TRAIL_WIDTH` com a
  grade de 5 colunas, e soltar um nó o encaixa na célula mais próxima; uma célula, um nó.
- [eu] Vindos do M1: `node_off_grid` e `background_width_mismatch` no portão de validação, e o
  aviso `chapter_without_campfire` (com um formato de aviso sem faixa numérica).
- [delegável] Editor: abertura do capítulo (texto + vídeo por upload ou URL) e vídeo na
  narrativa; issues `node_never_unlocks` e `node_off_grid` no painel do grafo.
- [delegável] Seed de playtest e fixtures com os nós na grade.
- [delegável] Jogador: tela de abertura ao entrar num capítulo (uma vez, reassistível) e página
  da narrativa com "Continuar".

### M5 — Conclusão e histórico (Etapa C)

**Status (2026-10-08): feito.** O encerramento grava em `finalData` o ouro (antes não ia),
`completed` e `chaptersCleared` (`mappers/history.ts`); `GET /api/history` lista o histórico do
próprio jogador, mais novo primeiro, e lê linhas antigas com os padrões do schema. Web (agente
Sonnet, revisado): faixa "Campanha concluída!" na sala com "Encerrar a sala" para o mestre, link
"Ver no histórico" na sala encerrada, página "Histórico" e o link no menu. Seed de playtest com dois
capítulos (agente Sonnet, revisado): o 2º tem narrativa de entrada obrigatória, dois corredores
obrigatórios que se juntam, loja e fogueira em ramos e o chefe; aberturas nos dois; publica sem
aviso nenhum. E2E novo `campaign-flow.spec.ts` (dois jogadores): aberturas, narrativa, batalha,
fogueira, derrota que volta à fogueira sem desfazer o que veio antes dela, chefe → capítulo 2,
chefe final → campanha concluída, encerrar, histórico dos dois. Suíte e2e 15/15; servidor 165.

- [eu] `finalData` com `completed` e capítulos concluídos; `GET /api/history`.
- [delegável] Sala concluída (faixa "Campanha concluída", encerrar em destaque para o mestre);
  página "Histórico".
- [delegável] E2E: dois jogadores — abertura, narrativa, batalha, fogueira, derrota e volta,
  chefe, capítulo 2, chefe final, sala concluída, encerrar, histórico.
- [delegável] Seed de playtest com dois capítulos, ramos, uma fogueira por capítulo e uma
  narrativa obrigatória.

### M6 — Playtest

**Status (2026-10-08): feito.** Guia em [phase-5-playtest.md](phase-5-playtest.md); playtest jogado em 2026-10-08. Correções que ele trouxe: o editor gerava ids com `crypto.randomUUID`, que não existe fora de contexto seguro (o jogo pelo IP da rede) — agora `lib/random-id.ts`; o nó novo nascia fora da vista — o canvas agora vai até ele.

- Guia de playtest da Fase 5. Perguntas: o mapa deixa claro o que fazer? A volta à fogueira
  dói na medida certa ou frustra? O grupo se divide nos ramos? Ajustes de regra voltam para a
  spec; números para `game-config`.

## Ordem e paralelismo

M0 → M1 → M2 → **M3 e M4 em paralelo** (web do mapa × autoria e vídeo; o ponto comum é o
`RoomDetail.chapters`) → M5 → M6.

## Riscos

- **Corrida entre derrota e vitória no mesmo capítulo**: o rollback e a conclusão disputam os
  mesmos fatos. As duas escritas passam pelo `lockRoom`, e a sequência da sala as ordena; o
  teste do M2 cobre as duas ordens.
- **Jogador que lutou nos dois ramos**: quem venceu A1 com o subgrupo A e depois perdeu B2 com
  o B desfaz A1 também (tomou parte nela). É coerente com a regra — a derrota é de quem lutou —,
  mas o playtest deve dizer se parece justo.
- **Versão nova mudando o mapa de uma sala em andamento**: nós e pré-requisitos novos aparecem
  ao rolar a versão (entre batalhas). Fatos guardados por id e conclusões que nunca se desfazem
  por publicação mantêm o mapa coerente; `chapter_order_changed` impede inserir capítulo antes.
- **Vídeo pesado**: o teto de upload e o storage S3/R2 com URL pública resolvem por ora; CDN e
  transcodificação ficam para quando houver uso real.
- **Sem linhas, o jogador pode não entender por que um nó está bloqueado**: o estado e o balão
  ajudam; se o playtest mostrar confusão, o próximo passo é o balão dizer o que falta, e só
  depois as linhas.
- **Editor preso à grade**: limita o autor que queria posicionar livremente sobre um mapa. É a
  troca aceita para a trilha funcionar igual em qualquer tela.
