# Fase 2 — Salas: plano detalhado

_Escopo de [spec §8](spec.md): criação pública e privada, código de acesso, sala de espera com
seleção de classe e controle de vagas, entrada e saída livres, transferência de mestre,
encerramento. Regras de domínio em spec §2.2 (avanço de versão), §5.2 (vagas) e §7 (ciclo de vida)._

**Status (2026-10-06):** M0–M5 implementados. Diferença do plano: o Socket.IO passou a ser
montado em `buildApp()` (`plugins/realtime.ts`) em vez de um decorator `app.io` registrado no
`server.ts`, para os testes de integração escutarem numa porta efêmera. Consequência observada no
e2e: um mestre sem classe que transfere o papel numa sala privada deixa de ser membro e perde o
acesso — coerente com a decisão 3.

## Objetivo e critério de pronto

Um usuário logado consegue: navegar no catálogo de campanhas publicadas → criar uma sala pública
ou privada (vira mestre) → outro usuário entra pela lista pública ou pelo código → escolhe uma
classe com vaga (classe lotada aparece indisponível) → os dois se veem **online** na sala em tempo
real → um sai e volta com o perfil intacto → um abandona em definitivo e libera a vaga → o mestre
transfere o papel → o mestre encerra a sala e o histórico é gravado. Se o autor publicar uma v2
compatível nesse meio-tempo, a sala passa a mostrar as classes novas sem ação do mestre.

## Pré-requisito: Fase 1b não foi feita

A seleção de classe precisa de classes publicadas, e hoje não existem: não há rotas nem editor de
classes, a fixture `valid-draft.json` não tem `classes`, e o `CharacterClassSchema` exige
`baseWeaponId` — ou seja, uma classe publicável depende também de um **item arma**, que não tem
CRUD. Duas saídas:

1. **(Recomendada) Fazer a 1b antes**, seguindo a ordem da spec. Inclui o mínimo de itens (CRUD
   de arma) para satisfazer `baseWeaponId`.
2. Fazer a Fase 2 em paralelo, desacoplada: todo o código de sala lê classes **só do snapshot**,
   então servidor e testes funcionam com uma fixture de snapshot (com classes e arma) inserida
   direto em `CampaignVersion`. Só o e2e e o uso manual ficam bloqueados até a 1b, ou exigem um
   script de seed de dev.

O plano abaixo vale para os dois caminhos; o marco M0 cria a fixture de snapshot de qualquer forma,
porque os testes de sala não devem depender do editor.

## Fora do escopo (decisões a vetar)

- **Batalha, sinal, presença em batalha** → Fase 3. A sala tem uma área "jogar" vazia.
- **Navegação pelo grafo do capítulo, fogueira, `completed`** → Fase 5. A sala não marca
  campanha cumprida nesta fase.
- **Bolsa, votação, loja, distribuição de pontos** → Fase 4.
- **Desconexão em batalha, reconexão robusta, múltiplas instâncias** → Fase 6. Aqui a presença é
  em memória num processo só (stack §3.3).

## Decisões de design

1. **REST para mutação, Socket.IO para presença e aviso.** Criar, entrar, escolher classe,
   transferir, sair e encerrar são `POST`s testáveis via `app.inject()`. O socket só faz duas
   coisas: presença (quem está online) e um sinal fino `room:changed` que o cliente transforma em
   `invalidateQueries`. Alternativa: mutações pelo socket com ack. Descarto: duplica validação e
   autorização, e testes de contrato ficam mais caros. A Fase 3 usa o socket para Commands de
   batalha, que é onde ele de fato é necessário.
2. **Contrato de tempo real de sala separado do de batalha.** Novo `shared-types/src/room-realtime.ts`
   com os eventos de sala (Zod). Não reusar `commands.ts`/`events.ts`: aqueles são o log
   determinístico do motor; presença não é fato de batalha e não entra em replay.
3. **Membro = tem `CampaignProfile` na sala.** O mestre é membro também, mas pode ainda não ter
   escolhido classe; por isso "membro" no código é `profile existe OU é o mestre`. A transferência
   de mestre só aceita destino com perfil (alguém que de fato está jogando).
4. **Vaga é verificada com lock da sala.** Escolher classe roda numa transação que faz
   `SELECT ... FROM "Room" WHERE id = $1 FOR UPDATE` antes de contar perfis da classe. Sem isso,
   dois jogadores pegam a última vaga ao mesmo tempo. `@@unique([roomId, userId])` já impede
   perfil duplicado. Alternativa: isolamento `Serializable` com retry — mais genérico, mais código.
5. **Abandonar em definitivo = apagar o perfil.** A spec (§5.2) só libera a vaga no abandono, e
   o perfil é contexto da sala; apagar é o modelo mais simples e o `@@unique` deixa a pessoa voltar
   como novo personagem nível 1. UI pede confirmação. "Sair" (fechar a aba, navegar) não toca no
   banco — é só presença.
6. **Avanço de versão é preguiçoso, num ponto único.** `advanceRoomVersion(roomId)` roda ao
   carregar a sala e ao escolher classe: se há versão publicada mais nova e a sala não tem batalha
   ativa, aponta `campaignVersionId` para ela. Na Fase 2 nunca há batalha ativa, mas o guard já
   nasce consultando o registro em memória de batalhas (vazio por ora), para a Fase 3 só preencher.
   Nenhum job em background. A compatibilidade já foi garantida no publish, então avançar é só
   trocar o ponteiro.
7. **Valores derivados numa função pura.** O perfil nasce com `currentHp`/`currentEnergy` cheios.
   O cálculo `maxHp = baseHp + hpPerLevel × (nível − 1) + ganhos de atributo` (spec §4.1, §4.3)
   vai em `battle-engine/src/derive-stats.ts`, lendo `ATTRIBUTE_GAINS` de `game-config`, porque o
   motor vai precisar do mesmo número na Fase 3. Servidor chama; ninguém recalcula à mão.
8. **Código de acesso:** 6 caracteres de alfabeto sem ambíguos (sem `0/O/1/I`), `crypto.randomInt`,
   retry em colisão do `@unique`. Gerado ao criar sala privada; mestre pode regenerar (invalida o
   anterior). Não é número de balanceamento, então fica em `apps/server/src/rooms/access-code.ts`,
   não em `game-config`.
9. **Encerrar grava histórico agora.** É barato e é onde a spec diz que acontece (§7):
   `status = 'closed'`, `closedAt`, e uma linha de `History` por perfil com o perfil serializado.
   Sala encerrada é só leitura e some das listagens. `completed` fica para a Fase 5.
10. **Campanha com sala não pode ser deletada.** Hoje `Room.campaign` não tem `onDelete` e o
    `DELETE /api/campaigns/:id` da Fase 1 quebraria com erro de FK. Passa a responder
    `409 campaign_has_rooms`. O autor não enxerga salas de terceiros (spec §2.2), então apagar
    a campanha não pode derrubá-las.

## Mudanças de schema (uma migration)

- `Room`: `name String`, `updatedAt DateTime @updatedAt`, `closedAt DateTime?`;
  `@@index([isPublic, status])` para a listagem pública.
- `CampaignProfile`: `createdAt DateTime @default(now())` (ordem da lista de membros).
- `GroupBag` é criado junto com a sala (gold 0) para a Fase 4 não lidar com bolsa nula.
- Nada destrutivo: só colunas novas com default. `name` sem default exige migration em tabela
  vazia — hoje não há salas, então ok.

## Marcos

`[eu]` = fica comigo (invariantes, concorrência); `[delegável]` = mecânico, com contrato de tarefa.

### M0 — Pré-requisitos

- [eu] Fixture `room-snapshot.json` (2 classes com `maxSlots` 1 e 2, uma arma, 1 capítulo) e
  helper de teste `publishFixtureVersion(app, authorId)` que insere `Campaign` + `CampaignVersion`
  direto. Uma segunda fixture `room-snapshot-v2.json` com uma classe a mais (testa avanço).
- [eu] `derive-stats.ts` no `battle-engine` + testes (nível 1, nível N, atributos).
- [delegável] Migration do schema acima; `RoomSchema` em `accounts.ts` ganha `name`.
- [eu] `409 campaign_has_rooms` no `DELETE` de campanha, com teste.

### M1 — Catálogo e criação de sala

- [delegável] `GET /api/catalog`: campanhas com ao menos uma versão publicada (nome, descrição,
  autor, última versão). Público para usuário logado.
- [delegável] `POST /api/rooms` `{ campaignId, name, isPublic }`: aponta para a última versão,
  cria `GroupBag`, gera código se privada, criador = mestre. 404 se a campanha não tem versão.
- [delegável] `GET /api/rooms` (públicas e abertas, paginado, com contagem de membros) e
  `GET /api/rooms/mine` (onde sou mestre ou tenho perfil).
- [delegável] Web: página de catálogo, formulário de criar sala, listas "salas públicas" e
  "minhas salas".

### M2 — Entrada e sala de espera

- [eu] Preguiça de versão (decisão 6) em `services/room-version.ts`, com teste: publica v2 →
  `GET` da sala passa a apontar para v2 e listar a classe nova.
- [delegável] `GET /api/rooms/:id`: dados da sala, membros (nome, classe, nível, caído),
  classes da versão vigente com `slotsTaken/maxSlots`, e `accessCode` só para o mestre. Não membro
  de sala privada recebe 404 (não vaza existência).
- [delegável] `POST /api/rooms/join` `{ code }` → `{ roomId }`. Sala pública não precisa de código:
  entrar nela é simplesmente escolher classe.
- [eu] `POST /api/rooms/:id/profile` `{ classId }` com lock da sala (decisão 4): valida classe na
  versão vigente, vaga, sala aberta, sala privada exige código já validado (o `join` devolve um
  ticket curto ou o próprio código vai no corpo — escolher o segundo, mais simples). Cria perfil
  com stats de `derive-stats`. Testes: lotada → 409 `class_full`; classe inexistente → 422;
  duas requisições simultâneas na última vaga → exatamente uma passa.
- [delegável] Web: sala de espera com cartões de classe (arte, vida/energia base, vagas,
  indisponível quando lotada) e lista de membros.

### M3 — Presença em tempo real

- [eu] Middleware de auth do Socket.IO: `auth.api.getSession` com os headers do handshake
  (mesmo `toHeaders` do `plugins/auth.ts`, extraído para um módulo reutilizado pelos dois);
  sem sessão → recusa a conexão. Web conecta com `withCredentials: true`.
- [eu] `realtime/presence.ts`: `Map<roomId, Map<userId, Set<socketId>>>` (várias abas contam
  como uma presença). `room:join` só aceita membro da sala; `disconnect` limpa.
- [delegável] `shared-types/src/room-realtime.ts`: `room:join` (cliente→servidor),
  `room:presence { onlineUserIds }` e `room:changed` (servidor→cliente), todos Zod.
- [delegável] Rotas de mutação emitem `room:changed` para o canal da sala após o commit. As rotas
  recebem o `io` via decorator (`app.io`), registrado em `server.ts`; nos testes de contrato é um
  stub que grava os emits.
- [delegável] Web: hook `useRoomChannel(roomId)` com `socket.io-client`, indicador online/offline
  por membro, `room:changed` → `invalidateQueries(['room', id])`.
- Testes: integração com `socket.io-client` contra o servidor ouvindo em porta efêmera — dois
  usuários, um entra, o outro recebe a presença; não membro é recusado.

### M4 — Saída, mestre e encerramento

- [delegável] `DELETE /api/rooms/:id/profile` (abandonar): apaga o perfil. O mestre não pode
  abandonar sem transferir antes (409 `master_must_transfer`), exceto se for o único membro.
- [delegável] `POST /api/rooms/:id/transfer` `{ userId }`: só o mestre; destino precisa ter perfil.
- [delegável] `POST /api/rooms/:id/access-code` (regenerar) e `PATCH /api/rooms/:id`
  (nome, pública/privada; virar privada gera código, virar pública zera).
- [eu] `POST /api/rooms/:id/close`: transação que grava `History` por perfil e fecha a sala;
  sala fechada recusa toda mutação (409 `room_closed`). Preparar o mesmo guard da batalha ativa
  da decisão 6: encerrar com batalha em andamento será recusado na Fase 3.
- [delegável] Web: menu do mestre (transferir, regenerar código, encerrar com confirmação),
  botão "abandonar sala" com confirmação explicando que o personagem é perdido.

### M5 — E2E

- [delegável] Playwright: dois contextos de navegador (dois usuários) fazem o fluxo do critério de
  pronto. Depende da 1b para publicar uma campanha com classes pela UI; até lá, o e2e usa o seed.

## Ordem e paralelismo

M0 primeiro. Depois **M1 e M3 andam em paralelo** (M3 só precisa saber o que é membro, que é uma
query). M2 depende de M1; M4 depende de M2. M5 fecha.

## Riscos

- **Corrida de vaga:** o ponto de falha silenciosa da fase. O teste de concorrência (decisão 4)
  é obrigatório, não opcional.
- **Cookie no handshake do socket:** web em `:3000` e servidor em outra porta. Se o cookie do
  Better Auth for `SameSite=Lax` em domínios diferentes no deploy, o socket chega sem sessão.
  Em dev funciona (mesmo host, porta diferente é same-site). Verificar no deploy da Fase 6.
- **Presença em memória:** reinício do servidor zera presença; os clientes reconectam e reenviam
  `room:join`. Aceitável para um processo só; Redis adapter só com múltiplas instâncias.
- **Avanço de versão preguiçoso:** uma sala que ninguém abre não avança — e não precisa, porque
  ninguém está jogando nela. O risco real é a Fase 3 esquecer de chamar o guard ao iniciar
  batalha; deixar um teste que inicia batalha e confirma que a versão fica fixa até o fim.
- **Perfil referenciando classe por id sem FK:** seguro só enquanto o portão de compatibilidade
  impedir deletar classe. Um teste de sala que publica v2 e confirma que o `classId` do perfil
  ainda resolve no snapshot novo amarra as duas fases.
