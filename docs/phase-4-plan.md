# Fase 4 — Progressão e economia: plano detalhado

_Escopo de [spec §8](spec.md): XP, nível, distribuição de pontos, desbloqueio de habilidades,
fator de relevância, loot, ouro, troca entre jogadores, loja, inventário e equipamentos. Regras
de domínio em spec §4.1 (atributos), §4.4 (nível), §4.5 (fator de relevância), §6 (economia e
itens) e §2.2.1 (o que a publicação permite)._

**Status (2026-10-07):** decisões 1–14 aprovadas. A economia mudou em relação à spec: **ouro e
loot são de cada jogador, e não há bolsa do grupo nem votação** — trocas diretas entre jogadores,
sempre aceitas pelas duas partes, e compra individual na loja (decisões 8–11); o ouro de cada um
é privado. As marcadas **(spec)** mudam o texto da spec e são gravadas lá no M0 (a §6 será
reescrita).

## Objetivo e critério de pronto

Numa sala com perfis (Fase 2), o grupo vence uma batalha (Fase 3) → cada participante recebe XP
e ouro pelo fator de relevância do nó, e às vezes um item → sobe de nível, ganha pontos e os
distribui; habilidades novas aparecem na batalha seguinte → numa loja, cada um compra com o
próprio ouro → jogadores dão ou trocam ouro e itens entre si, numa oferta que o outro aceita →
o dono equipa, desequipa e usa consumíveis livremente, e o que ele equipa muda o dano e a defesa
na próxima batalha. **Os sorteios de loot saem do PRNG da batalha e ficam no log: o replay
reproduz as recompensas exatas** — o mesmo teste de propriedade que fechou a Fase 3 continua
verde, agora com recompensas.

## Pendências herdadas (resolver no M0)

Levantamento de 2026-10-07 sobre `develop`:

1. **`develop` está 17 commits à frente de `main`** (Fases 2 e 3). O PR será aberto ao fim da Fase 4,
   levando as fases juntas.
2. **Consumível gasto em batalha não sai do inventário.** O motor decrementa a pilha no estado
   (`evolve.ts`), mas o write-back (`battle-resolution.ts` → `profileOutcomes`) grava só HP,
   energia e caído: a poção volta inteira na batalha seguinte. Com loja, vira ouro infinito.
   Corrigir no M0 com um teste.
3. **O perfil não sobe de nível em lugar nenhum**: `level`, `xp` e `availablePoints` existem na
   tabela (`CampaignProfile`) desde a Fase 0 e nunca mudam. `create-battle.ts` já filtra
   habilidades por `unlockLevel <= level`, então o desbloqueio "funciona" assim que o nível subir.
4. **O conteúdo não tem os números da economia**: item não tem preço e vilão não tem XP, ouro nem
   tabela de drop. A spec §4.5 multiplica "experiência, ouro e chance de drop", mas não diz de
   onde vem a base (decisão 1).
5. **`GroupBag` sai** (decisão 8): a tabela é criada com a sala e nunca foi lida; o ouro passa
   para o perfil. A spec cita a bolsa em §2.1, §3.7 e §6.

## Fora do escopo

- **Onde o grupo está no grafo** (nó desbloqueado, loja "alcançada") → Fase 5. Aqui qualquer nó
  `shop` da versão vigente pode ser aberto, como os nós de batalha na Fase 3 (decisão 11).
- **Fogueira e volta à última fogueira na derrota** → Fase 5. O descanso provisório do mestre
  continua.
- **Raridade como atributo do item, vender à loja, estoque limitado**: a spec §6 deixa para
  depois. A raridade de um drop é só a chance dele (decisão 1).
- **Redistribuir pontos (respec)**: a spec não prevê; o ponto gasto é permanente.
- **Ofertas de troca resistentes a queda do servidor** → Fase 6.

## Decisões de design

Cada uma tem uma recomendação e, quando faz sentido, uma alternativa.

1. **(spec §6) Aprovada. A recompensa base vem do vilão, e drop é raro.** Cada vilão ganha
   `xpReward`, `goldReward` e uma tabela `drops: [{ itemId, chance }]`. Uma batalha vale a soma
   dos inimigos da formação (dois ratos = duas vezes o rato). **Nenhum drop é garantido**:
   - O autor escolhe a chance de cada entrada a partir de **faixas** (`DROP_CHANCE_TIERS` em
     `game-config`, propostas: comum 35%, incomum 12%, raro 3%), com um campo livre para ajuste
     fino. Item simples na faixa comum, item bom na rara.
   - **Teto de chance `MAX_DROP_CHANCE` (proposta 60%)**, que vale também depois do fator de
     relevância: nem o atrasado com fator 3× tem drop certo. O validador recusa chance acima do
     teto; `draftWarnings` avisam item caro (pelo preço) numa faixa comum.
   - Como drop é raro, o ouro é a fonte principal de equipamento (pela loja).
2. **(spec §4.5) O fator de relevância é por jogador, em tudo.** Base: o `recommendedLevel` do nó
   (batalha e chefe já o têm). Cada participante, com o fator do próprio nível, recebe:
   - **XP**: `floor(XP da batalha × fator)`;
   - **ouro**: `floor(ouro da batalha × fator)`;
   - **drops**: a tabela de cada inimigo sorteada **para ele**, com `min(MAX_DROP_CHANCE,
chance × fator)`.

   **Nada é dividido** pelo tamanho do grupo: dividir puniria quem joga junto, que é o ponto da
   plataforma. Cada um sorteia o próprio loot, então não há disputa por item.

3. **(spec §6) Quem recebe.** Só há recompensa na **vitória**. Participantes **caídos no fim
   recebem** (o grupo venceu junto). **Quem saiu da batalha não recebe** — saiu antes do fim. A
   derrota não dá nada e custa ouro (decisão 10).
4. **Recompensas são um evento do motor.** No turno em que a batalha é vencida, `decide` emite
   `RewardsGranted { rewards: [{ profileId, xp, gold, items: itemId[] }] }` antes de
   `BattleResolved`, com os números já resolvidos e os sorteios pelo `DecideContext`. É público
   (cada um vê o que todos ganharam) e entra no replay. O `BattleContent` ganha o
   `recommendedLevel` do nó; os vilões já viajam inteiros e o combatente já carrega o nível.
   Alternativa: o servidor calcula no write-back — tiraria o loot do log e do teste de replay, e
   precisaria de outra fonte de aleatoriedade.
5. **Subir de nível é uma função pura, aplicada no write-back.** `gainXp(level, xp, amount) →
{ level, xp, pointsGained }` em `battle-engine/src/progression.ts`, com `xpForNextLevel` e
   `ATTRIBUTE_POINTS_PER_LEVEL` de `game-config`. Vários níveis de uma vez são possíveis (o
   atrasado da spec §4.5). No `MAX_LEVEL`, o XP para de acumular.
6. **(spec §4.4) Subir de nível ou investir pontos aumenta a vida e a energia atuais pelo mesmo
   tanto que aumentou o teto.** Quem estava com 30/100 e sobe para um teto de 112 fica com 42/112.
   Caído continua caído com 0. Subir de nível não cura por completo (a fogueira faz isso), mas
   também não "perde" o ganho.
7. **(spec §4.4) Distribuir pontos é livre e permanente.** O jogador gasta `availablePoints` em
   força, destreza ou inteligência a qualquer momento fora de batalha. Não há respec.
8. **(spec §2.1, §6) Ouro e itens são de cada jogador; a bolsa do grupo e a votação saem.** O
   perfil ganha `gold`. Tudo o que a batalha dá vai direto para quem ganhou; o inventário pessoal
   guarda os itens. A tabela `GroupBag` é removida (nunca foi lida).
9. **(spec §6) Troca entre jogadores: uma oferta, aceita pelo outro, aplicada de uma vez.** **Toda
   operação entre jogadores precisa do aceite das duas partes**, inclusive o presente. Um
   jogador monta uma oferta para outro membro da sala: **o que ele dá** (ouro e/ou itens do
   inventário) e **o que ele pede** (ouro e/ou itens do inventário do outro). Isso cobre os três
   casos com um mecanismo só:
   - **presente**: dá algo, não pede nada;
   - **venda**: dá um item, pede ouro;
   - **troca**: item por item, com ou sem ouro na diferença.

   O outro aceita ou recusa; quem ofereceu pode cancelar. Ao aceitar, **uma transação sob
   `lockRoom` revalida os dois lados** (cada um ainda tem o que prometeu) e move tudo junto — nunca
   metade. Regras:
   - Só itens do **inventário** entram; item equipado precisa ser desequipado antes.
   - Os dois precisam estar **fora de batalha** (a batalha leu o perfil ao começar; decisão 12).
   - Uma oferta pendente por par de jogadores; ela expira após `TRADE_OFFER_TIMEOUT_MS`
     (`game-config`) e some se um dos dois sair da sala.
   - Ofertas ficam **em memória**, como as batalhas: um crash perde só a oferta, nada foi movido.

   - **O ouro é privado**: ninguém vê o saldo do outro. Pedir ouro numa oferta não revela nada;
     se o outro não tiver, o aceite é recusado (`409 insufficient_gold`) sem dizer quanto falta.

10. **(spec §3.7) Derrota custa `DEFEAT_GOLD_LOSS_FRACTION` do ouro de cada participante**
    (`game-config`, proposta 0,2, arredondado para baixo), aplicado no write-back da derrota. Só
    quem lutou perde; quem saiu antes do fim também perde (abandonar não pode ser a saída barata).
    A volta à fogueira continua na Fase 5.
11. **(spec §6) Loja individual.** Abrir a loja de um nó (qualquer membro com perfil, fora de
    batalha) mostra os itens do `itemIds` do nó com o preço da versão vigente. Cada jogador compra
    com o próprio ouro, uma ou mais unidades por vez, numa transação que revalida o saldo. Sem
    estoque limitado, sem votação. O item ganha `price` (inteiro ≥ 0).
12. **Inventário e equipamento são do dono, fora de batalha.** Equipar, desequipar, trocar de slot,
    distribuir pontos, comprar e trocar são recusados com `409 in_battle` enquanto o jogador estiver
    numa batalha (formando ou rodando). O write-back passa a gravar o **consumo como delta** (tira as
    unidades gastas) e a **somar** ouro e itens ganhos, sem sobrescrever inventário nem ouro. Equipar
    exige os requisitos de atributo (spec §4.1) e o slot do item. **O slot de arma só troca, nunca
    esvazia** (o ataque básico precisa de uma arma), e a arma base é um item como outro qualquer.
13. **(spec §6) Consumível fora de batalha.** Usar um consumível fora de batalha é livre, mas só
    vale para os efeitos que fazem sentido sem combate e sem rodadas: `heal` e `restore_energy` no
    próprio dono, e `revive` em qualquer perfil caído da sala. Os demais (dano, buff, escudo…) só
    em batalha. Reaproveita a resolução de magnitude do motor (`effects/magnitude.ts`).
    Alternativa: só em batalha — mais simples, mas o descanso do mestre vira a única cura entre
    batalhas até a Fase 5.
14. **Conteúdo novo entra com padrão, e a publicação continua compatível.** `price`, `xpReward`,
    `goldReward` e `drops` são campos **aditivos com padrão 0 / vazio** no
    `CampaignSnapshotSchema`, então versões já publicadas continuam válidas (e não dão
    recompensa até o autor publicar números). Pelo §2.2.1 esses números são balanceamento: mudar
    é permitido. O portão de validação recusa drop para item inexistente e chance fora de
    0–`MAX_DROP_CHANCE`; `draftWarnings` avisam vilão sem XP, item à venda sem preço e recompensa
    fora da faixa recomendada (`REWARD_GUIDE` em `game-config`).

## Mudanças de contrato (`shared-types`) e de schema

- `content.ts`: `VillainSchema` ganha `xpReward`, `goldReward` (inteiros ≥ 0, padrão 0) e
  `drops: [{ itemId, chance }]` (padrão `[]`); `ItemEquipmentSchema` e `ItemConsumableSchema`
  ganham `price` (inteiro ≥ 0, padrão 0). Mesmos campos nos payloads de autoria
  (`authoring-inputs.ts`).
- `battle-content.ts`: `recommendedLevel` do nó.
- `events.ts`: `RewardsGranted { rewards: [{ profileId, xp, gold, items }] }`, público.
- `accounts.ts`: `CampaignProfileSchema` ganha `gold`; `GroupBagSchema` sai.
- Contratos novos:
  - `profile.ts`: a ficha do próprio perfil — nível, XP e XP do próximo nível, pontos, ouro,
    atributos, equipamento e inventário com nome/slot/requisitos/preço, estatísticas derivadas.
  - `trade.ts`: `TradeOfferSchema { id, fromProfileId, toProfileId, give: { gold, items },
ask: { gold, items }, expiresAt }` e os payloads de propor, aceitar, recusar, cancelar.
  - `shop.ts`: a vitrine de um nó (itens com preço) e `BuyInput { itemId, quantity }`.
  - Payloads do dono: `SpendPointsInput`, `EquipInput { itemId }`, `UnequipInput { slot }`,
    `UseItemInput { itemId, targetProfileId? }`.
- `rooms.ts`: `RoomDetail` ganha `shopNodes` (provisória, como `battleNodes`), o ouro do
  próprio leitor (o dos outros é privado, decisão 9) e as ofertas de troca em que o leitor é uma
  das partes.
- Prisma (uma migration): `CampaignProfile.gold Int @default(0)`; vilão ganha `xpReward`,
  `goldReward`, `drops` (jsonb); item ganha `price`; **remove `GroupBag`**. Inventário continua
  jsonb de ids (repetição = quantidade, como hoje).
- `game-config`: `DROP_CHANCE_TIERS`, `MAX_DROP_CHANCE`, `REWARD_GUIDE` (faixas recomendadas de XP
  e ouro por vilão, por nível), `DEFEAT_GOLD_LOSS_FRACTION`, `TRADE_OFFER_TIMEOUT_MS`.

## Marcos

`[eu]` = invariantes, determinismo, concorrência; `[delegável]` = mecânico, com contrato de tarefa.
Três etapas: **A** progressão (recompensa → nível → pontos → habilidade nova), **B** inventário,
equipamento e loja, **C** troca entre jogadores. Cada etapa fecha com algo jogável.

### M0 — Pré-requisitos e decisões

**Status (2026-10-07): feito.** O consumo de consumíveis vai ao perfil como delta:
`consumedItems(log)` (`battle-outcome.ts`) lista as unidades gastas, e o write-back as tira do
inventário dentro da mesma transação. Teste em `battle-socket.test.ts` (falha sem a correção).
Spec reescrita: §2.1 (sai a Bolsa do Grupo, o perfil tem ouro), §3.7, §4.4, §4.5, §6 e §8. O PR
`develop` → `main` será aberto pelo usuário ao fim da Fase 4, com as duas fases.

- [usuário] PR `develop` → `main`, aberto ao fim da Fase 4 (leva as Fases 3 e 4).
- [eu] Corrigir o consumo de consumível no write-back (pendência 2), com teste de servidor: usar
  uma poção, vencer, conferir o inventário.
- [eu] Reescrever na spec o que é **(spec)**: §2.1 (sai a Bolsa do
  Grupo), §3.7 (custo da derrota), §4.4, §4.5 (fator por jogador em XP, ouro e drop) e §6 inteira
  (ouro e loot individuais, troca, loja individual, sem votação).

### M1 — Contratos e conteúdo (Etapa A)

**Status (2026-10-07): feito.** `game-config/economy.ts` (`DROP_CHANCE_TIERS`, `MAX_DROP_CHANCE`,
`REWARD_GUIDE`, `DEFEAT_GOLD_LOSS_FRACTION`, `TRADE_OFFER_TIMEOUT_MS`). Vilão com `xpReward`,
`goldReward` e `drops` (`VillainDropSchema`, chance ≤ teto), item com `price`, perfil com `gold`,
`BattleContent.recommendedLevel`; todos aditivos com padrão, e um teste prova que um snapshot de
antes continua válido. Migration `phase4_economy` (colunas novas, sai `GroupBag`). Publicação:
drop para item inexistente é `missing_reference`; avisos novos em `economy-warnings.ts`
(`battle_xp_out_of_band`, `battle_gold_out_of_band`, `drop_chance_high`, `item_price_missing`).
Editor: preço no item e `villain-rewards-fields.tsx` (XP, ouro, drops por raridade com ajuste
fino). Ajustes ao plano: o `RewardsGranted` fica para o M2, junto da regra que o emite; o aviso
"item caro em faixa comum" virou "drop acima da faixa comum" (`drop_chance_high`), que não depende
de comparar preços.

- [eu] Campos novos em `content.ts`, `battle-content.ts`, `events.ts`, `accounts.ts` e
  `game-config`, com padrões; teste de que os snapshots das fixtures ainda passam no schema.
- [eu] Migration (vilão, item, `gold` no perfil, sai `GroupBag`) e mapeamento rascunho →
  snapshot.
- [delegável] Editor de vilão: XP, ouro e tabela de drop (item da campanha + faixa comum/incomum/
  raro, com ajuste fino). Editor de item: preço. Avisos em `draftWarnings`.
- [eu] Portão de validação: drop para item inexistente, chance fora de 0–`MAX_DROP_CHANCE`.

### M2 — Motor: recompensas e progressão (Etapa A)

**Status (2026-10-07): feito.** `RewardsGranted { rewards: [{ profileId, xp, gold, items }] }`
(`battle-rewards.ts`, público) sai de `rewards.ts` quando `resolveIfOver` vê a vitória, logo antes
do `BattleResolved`; `evolve` o guarda em `state.rewards` (vazio até lá), então quem entra depois
também vê. Sorteios pelo `DecideContext` na ordem participante → inimigo → drop; sem drop, nenhum
sorteio. `progression.ts`: `gainXp`, `applyXp`, `spendPoints` (recusas `invalid_points` e
`not_enough_points`), com o ajuste de vida e energia atuais da decisão 6. Testes: `rewards.test.ts`
(fator por nível, caído recebe, quem saiu não, ordem fixa, teto de drop em 2000 seeds),
`progression.test.ts`, e a propriedade de replay agora vence com XP, ouro e drops — vitória sempre
com `RewardsGranted` imediatamente antes do fim, derrota nunca, e drops variando por seed.

- [eu] `RewardsGranted` em `decide` na vitória: XP, ouro e drops por participante com o fator de
  cada um, sorteios pelo `DecideContext` (decisões 1–4). `evolve` só guarda o evento no estado.
- [eu] `progression.ts`: `gainXp`, `spendPoints`, ajuste de vida e energia atuais quando o teto
  sobe (decisões 5–7). Testes de tabela: subir vários níveis, teto no `MAX_LEVEL`, caído.
- [eu] Teste de replay estendido: a propriedade dos 200 seeds termina em vitória com drops, e o
  replay reproduz o `RewardsGranted` exato. Teste estatístico do teto: com fator 3× e chance rara,
  nenhum sorteio passa de `MAX_DROP_CHANCE`.

### M3 — Servidor e web da progressão (fecha a Etapa A)

**Status (2026-10-07): feito.** `settleProfile` (`battle-settlement.ts`, puro) calcula o perfil
depois da batalha — recursos, consumo, XP com subida de nível, ouro e drops, ou a perda de ouro na
derrota — e o write-back só o aplica, lendo o perfil sob o `lockRoom`. `GET /api/rooms/:id/profile`
devolve a ficha do dono (`ProfileSheet`, com ouro privado e `baseDefense`) e `POST
.../profile/points` investe pontos (`409 in_battle`, `422 not_enough_points`). O
`RewardsGranted` passou a levar o nome do item (`items: [{ itemId, name }]`): o cliente não tem o
catálogo. Web: recompensas por participante na tela de fim de batalha; ficha na sala (nível,
barra de XP, ouro, vida/energia, atributos, defesa, habilidades com nível de desbloqueio,
inventário) e distribuição de pontos com prévia e confirmação. Seed de playtest com recompensas
dentro da faixa (sem avisos), quatro itens com preço e um nó de loja. Testes:
`profile-progress.test.ts` (vitória com subida de nível e drops, derrota com perda de ouro de quem
saiu, pontos, recusas). Conferido no navegador: batalha dos ratos jogada pela interface, ficha e
distribuição de pontos.

- [eu] Write-back na vitória: XP → nível → pontos → recursos atuais, ouro e itens somados, delta
  de consumíveis; na derrota, a perda de ouro (decisão 10). Tudo na mesma transação sob
  `lockRoom`.
- [eu] `POST /api/rooms/:id/profile/points` (decisão 7), `409 in_battle`.
- [delegável] Web: tela de fim de batalha com o que cada um ganhou (do `RewardsGranted`) e aviso
  de nível novo; ficha do personagem na sala (nível, barra de XP, ouro, pontos a distribuir com
  prévia da vida/energia/defesa resultante, habilidades com nível de desbloqueio).
- [delegável] Seed de playtest: vilões com XP/ouro/drops nas três faixas, itens com preço, um nó
  de loja.

### M4 — Inventário, equipamento e loja (Etapa B)

- [eu] `canEquip` puro (requisitos, slot, arma nunca vazia) e o uso fora de batalha
  (`heal`, `restore_energy`, `revive`; decisão 13) em `battle-engine`.
- [eu] Rotas do dono: equipar, desequipar, usar item, comprar na loja (decisões 11–12), todas com
  `409 in_battle` e sob `lockRoom`.
- [delegável] Web: equipamento por slot e inventário na ficha, com requisitos não atendidos
  explicados; lista de lojas da versão (provisória) e página da loja com preço e o ouro do
  jogador.
- [eu] Testes: equipar sem requisito recusado; equipar muda a defesa/dano na batalha seguinte;
  equipar durante batalha recusado; comprar sem ouro recusado; usar poção fora de batalha cura e
  some do inventário.

### M5 — Troca entre jogadores (Etapa C)

- [eu] `services/trade-offers.ts` em memória: propor, aceitar, recusar, cancelar, expirar
  (decisão 9). Aceitar revalida os dois lados e move tudo numa transação sob `lockRoom`.
- [eu] Rotas REST que emitem `roomEvents.changed`; sair da sala ou entrar em batalha derruba as
  ofertas do jogador.
- [eu] Testes: presente, venda e troca; aceitar quando quem ofereceu já gastou o ouro (recusado,
  nada se move); dois aceites simultâneos de ofertas que usam o mesmo item (só um passa); oferta
  com item equipado recusada; oferta com alguém em batalha recusada.
- [delegável] Web: "oferecer" a partir de um membro da sala (o que dou / o que peço), ofertas
  recebidas com aceitar/recusar, ofertas enviadas com cancelar.
- [delegável] E2E: dois jogadores vencem uma batalha e veem a recompensa; um compra uma poção na
  loja, vende ao outro por ouro; o outro a usa fora de batalha.

### M6 — Playtest

- Playtest com pessoas: ritmo da subida de nível (a curva de 100 × nível com as recompensas do
  seed), se o ouro rende o bastante na loja, se drop raro "parece" raro, e se a troca é fácil de
  usar. Ajustes vão para `game-config`.

## Ordem e paralelismo

M0 → M1 → **M2 e o editor do M1 em paralelo** → M3 (playtest curto da Etapa A, se der) → **M4 e
M5 em paralelo** (tocam arquivos diferentes; o ponto comum é o `lockRoom` e a regra `in_battle`)
→ M6.

## Riscos

- **Determinismo**: o loot é o primeiro sorteio que acontece fora do combate em si. Tem que sair
  do `DecideContext` e do PRNG do estado; o teste de replay com drops (M2) é obrigatório.
- **Write-back sobrescrevendo o que mudou durante a batalha**: ouro e inventário de quem luta não
  mudam (rotas recusam `in_battle`), mas o write-back aplica **deltas** de qualquer jeito, para não
  depender disso.
- **Item ou ouro duplicado numa troca**: os dois lados são revalidados dentro da mesma transação, e
  o `lockRoom` serializa aceites concorrentes. Testar a corrida explicitamente (M5).
- **Inflação**: com loot e ouro por jogador sem divisão, um grupo de 4 gera 4× o ouro total de um
  solo (o mesmo por cabeça). A troca permite concentrar ouro num jogador. As faixas de
  `REWARD_GUIDE`, o teto de drop e o playtest calibram.
- **Versão nova no meio da economia**: a sala avança de versão entre batalhas; o preço pode mudar
  com a loja aberta. A compra lê o preço da versão vigente no momento em que é feita, e a página
  mostra o preço atual.
