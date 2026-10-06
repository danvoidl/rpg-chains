# Fase 1b — Classes e habilidades: plano detalhado

_Escopo de [spec §8](spec.md): motor de efeitos genéricos, editor de classes com vida e energia
base, montagem de habilidades a partir do catálogo de efeitos, validações e limites, limite de
vagas por classe, kit padrão de quatro classes importável por cópia. Regras em spec §4.3, §5 e
§2.2.1._

**Status (2026-10-06):** M0–M5 e M7 implementados. M6 (estimativa de dano por rodada) foi
cortado, como previsto.

## Objetivo e critério de pronto

Um autor logado consegue: importar o kit padrão (quatro classes, com habilidades e armas base,
todas cópias editáveis) → criar uma classe própria com arma base e até quatro habilidades
montadas a partir do catálogo de efeitos → ver avisos de faixa recomendada e erros que bloqueiam
→ **publicar** uma versão com classes → publicar uma v2 que rebalanceia uma habilidade (aceita)
→ tentar uma v3 que remove uma habilidade de uma classe ou muda a vida base (**recusada**). O
snapshot resultante tem `classes` e `items` preenchidos, o que destrava a seleção de classe da
[Fase 2](phase-2-plan.md).

## O que já existe (Fase 0 e 1)

- Schemas: `EffectSchema` com os 13 tipos, `MagnitudeSchema` (fixo / percentual / escala),
  `SkillSchema`, `CharacterClassSchema` (máx. 4 habilidades, `baseWeaponId` obrigatório),
  `ItemSchema` (arma exige `weapon`, consumível exige `effect`).
- Tabelas `CharacterClass`, `Skill`, `Item` no Prisma, sem rotas.
- Portão de compatibilidade com `class_base_changed`, `class_slots_reduced`, `skill_removed` e
  deleção de classe, habilidade e item, já testados.
- `game-config`: faixas de classe, faixas de custo e cooldown, `DEFAULT_CLASS_KIT` só com números
  base, sem habilidades.

O que falta é o caminho rascunho → snapshot (`draftToSnapshot` hoje devolve `classes: []` e
`items: []`), as regras de validação, a API e o editor.

## Fora do escopo (decisões a vetar)

- **Execução dos efeitos em combate** → Fase 3. A spec põe "motor de efeitos genéricos" na 1b,
  mas a resolução com duração e empilhamento está listada na Fase 3. Aqui, "motor" = efeitos
  como **dados validados**: tipos, alvos permitidos por tipo, faixas e limites. O que o efeito
  faz em batalha só existe quando houver batalha.
- **Loja, inventário, equipar, requisitos de atributo em uso** → Fase 4. Itens entram agora
  porque a classe exige arma base; o CRUD é completo (é barato), mas nada os consome além disso.
- **Distribuição de pontos e desbloqueio de habilidade por nível em jogo** → Fase 4. Aqui o
  `unlockLevel` é só um campo validado.

## Decisões de design

1. **Ids de habilidade são estáveis entre salvamentos.** O portão de compatibilidade compara por
   id; recriar habilidades a cada `PUT` da classe faria toda edição parecer "habilidade removida".
   O `PUT` da classe recebe as habilidades com `id` opcional e faz upsert por id (novo → cria;
   ausente → apaga; existente → atualiza), numa transação. Teste explícito: editar só a magnitude
   e republicar não gera violação.
2. **Erros bloqueiam; avisos pedem confirmação, não persistem.** `validateDraft` passa a devolver
   também `warnings` (não bloqueiam o publish). O editor mostra os dois e pede `confirm` ao salvar
   com aviso; a tela de publicar lista os avisos. Não guardo um flag "autor confirmou" no banco: a
   confirmação é de UX, e a spec só pede que o autor não passe por cima sem ver. Alternativa:
   persistir o reconhecimento por habilidade. Descarto: é estado extra sem uso no jogo.
   - **Erros:** nenhuma classe; classe sem arma base, ou arma base que não é item `weapon`;
     custo 0 **e** cooldown 0 ao mesmo tempo; alvo não permitido para o tipo de efeito; duração de
     atordoar ou de redução de vida máxima acima do teto; `unlockLevel` fora de `1..MAX_LEVEL`;
     mais de 4 habilidades.
   - **Avisos:** vida/energia base e ganho por nível fora das faixas (§4.3); custo fora de 15–40
     ou cooldown fora de 2–5; magnitude fora da faixa recomendada do tipo; soma das vagas abaixo
     do mínimo recomendado de grupo (§5.2).
3. **Alvos permitidos por tipo vivem em `campaign-rules`** (`effect-targets.ts`), usados pelo
   editor (filtra o select) e pelo portão. Dano, dano contínuo, debuff, atordoar e redução de vida
   máxima → inimigo(s); cura, cura contínua, restaurar energia, escudo e buff → próprio/aliado(s);
   reerguer → aliado(s); dissipar → qualquer; provocar não tem alvo. É regra de jogo, não número,
   então não vai para `game-config`.
4. **Faixas e tetos novos vão em `game-config`** (convenção do repo): faixa recomendada de
   magnitude por tipo e modo, teto de duração de atordoar e de redução de vida máxima, mínimo
   recomendado de vagas somadas. **Os números são propostas minhas para você aprovar** — mudam a
   cada playtest.
5. **Kit padrão em `game-config`, como dados puros.** `shared-types` depende de `game-config`
   (`AttributeSchema` lê `ATTRIBUTES` de lá), então `game-config` não pode importar
   `EffectSchema` sem criar ciclo. O kit fica como literais `as const` (classes + arma base + 4
   habilidades cada), e um teste em `campaign-rules` faz parse de cada entrada com
   `SkillSchema`/`ItemSchema`, para que um erro de forma quebre o build e não o import.
6. **Habilidades do kit = pendência aberta da spec (§9).** Proponho as 16 habilidades num
   rascunho para você validar antes de virarem código, usando o catálogo da §5.4 e as faixas da
   §4.3 (ex.: Guardião = provocar + escudo em si + debuff de dano + atordoar curto). É trabalho
   de design de jogo, não de engenharia.
7. **Importar o kit é cópia com ids novos**, numa transação: 4 armas + 4 classes + 16 habilidades.
   Importar duas vezes cria duas cópias (o autor apaga o que não quer). Sem vínculo com o kit.
8. **Lacuna da spec no portão: mudar slot ou categoria de um item publicado.** Um item que vira
   consumível, ou uma arma que vira capacete, invalida um personagem que o tem equipado. A tabela
   §2.2.1 não cobre isso. Proponho a violação `item_kind_changed` (categoria, slot, tipo de arma);
   números do item continuam livres. Vetável — se preferir seguir a spec à risca, fica de fora.
9. **Apagar item em uso como arma base segue o padrão da Fase 1:** o rascunho permite, o portão
   aponta `missing_reference`. Mesmo comportamento de apagar um vilão usado por um nó.

## Mudanças de schema

Provavelmente **nenhuma migration**: `CharacterClass`, `Skill` e `Item` já têm as colunas que os
schemas exigem. Ordem de exibição segue o padrão dos vilões (nome, id). Se o editor precisar de
ordem manual das habilidades, entra `Skill.order Int @default(0)` — decidir em M2.

## Marcos

`[eu]` = fica comigo (invariantes, portões); `[delegável]` = mecânico, com contrato de tarefa;
`[você]` = decisão de design de jogo.

### M0 — Números e kit

- [eu → você] Propor as faixas e tetos da decisão 4 e as 16 habilidades + 4 armas do kit
  (decisão 6), num rascunho para aprovação.
- [delegável] Depois de aprovado: constantes em `game-config/src/skills.ts` e o kit completo em
  `classes.ts`.
- [eu] Teste em `campaign-rules` que faz parse do kit com os schemas.

### M1 — Itens

- [delegável] `ItemInputSchema` em `authoring-inputs.ts`, mapper, CRUD
  `/api/campaigns/:campaignId/items`. Testes: arma sem `weapon` → 400; equipamento comum com
  `weapon` → 400; consumível com efeito inválido → 400; 403 em campanha alheia.
- [eu] Rascunho e snapshot: `CampaignDraftSchema.items`, `loadCampaignDraft`, `draftToSnapshot`
  mapeia itens; `validateDraft` passa a usar os itens reais no pool `itemIds` (os nós de loja
  ganham referências válidas de graça).
- [delegável] Web: página "Itens" para equipamentos e armas. O formulário de consumível entra em
  M4, porque reusa o formulário de efeito.

### M2 — Classes e habilidades (API)

- [delegável] `ClassInputSchema` (classe + `skills[]` com `id` opcional), mapper, CRUD
  `/api/campaigns/:campaignId/classes`. `PUT` com upsert de habilidades por id (decisão 1).
- [eu] `CampaignDraftSchema.classes`, `loadCampaignDraft`, `draftToSnapshot` com classes. Teste de
  round-trip rascunho → snapshot → `CampaignSnapshotSchema.parse` com classes e itens.
- [eu] Teste do upsert: salvar a classe com uma habilidade editada mantém o id; publicar v2 não
  gera violação.

### M3 — Regras (portões)

- [eu] `effect-targets.ts` (decisão 3) e as regras de erro da decisão 2 em `validateDraft`, cada
  uma com teste que passa e teste que falha. Novo código `no_classes` e os códigos de habilidade
  (`skill_free`, `invalid_target`, `duration_over_cap`, `revive_over_cap`,
  `base_weapon_invalid`). O `unlockLevel` fora de `1..MAX_LEVEL` é barrado já na escrita
  (`SkillInputSchema`), não no portão.
- [eu] Canal de `warnings` em `validateDraft` (decisão 2) e no retorno do publish (201 com
  `warnings`, sem bloquear). `issues.ts` ganha `DraftWarning`.
- [eu] `item_kind_changed` no `checkCompatibility`, se aprovado (decisão 8).
- [delegável] Mensagens em PT-BR dos novos códigos nas listas da tela de publicar
  (`issue-messages.ts`, `violation-messages.ts`).

### M4 — Editor de classes e habilidades (web)

- [delegável] Página "Classes" na navegação da campanha: lista com vida/energia base, vagas e
  arma base; formulário da classe (faixas como aviso inline, select de arma filtrando
  `slot === 'weapon'`, upload da arte com o `ImageUpload` existente).
- [delegável] Editor de habilidade dentro da classe (até 4): campos comuns + **formulário de efeito
  dirigido pelo `type`** — trocar o tipo troca os campos, o select de alvo é filtrado por
  `effect-targets`, a magnitude tem sub-formulário por modo (fixo / percentual / escala com
  atributo). Componente único `effect-form.tsx`, reusado pelo consumível de M1.
- [delegável] Erros e avisos do `validateDraft` ao vivo no formulário, como no editor de grafo;
  `confirm` ao salvar com aviso.
- Contrato da tarefa precisa listar os 13 tipos e os campos de cada um (vem de `effects.ts`), para
  o executor não inventar campo.

### M5 — Kit padrão

- [delegável] `POST /api/campaigns/:campaignId/classes/import-kit`: transação que copia o kit
  com ids novos (decisão 7). Teste: 4 classes, 16 habilidades, 4 armas, cada classe aponta para a
  sua arma; segunda importação duplica sem erro.
- [delegável] Botão "Importar kit padrão" na página de classes (destaque no estado vazio).

### M6 — Estimativa de dano por rodada (cortável)

- [eu] Função pura que estima o dano médio por rodada de uma classe num nível (ataque básico com a
  arma base + habilidades de dano amortizadas por cooldown), usando a fórmula de
  `battle-engine/damage.ts`, comparada ao kit. Mostrada no editor como "±X% do kit". A spec
  diz "vale exibir"; é a primeira coisa a cortar se a fase apertar.

### M7 — E2E

- [delegável] Playwright: importar kit → editar a magnitude de uma habilidade → publicar v1 →
  publicar v2 (aceita) → remover uma habilidade de uma classe → v3 recusada com `skill_removed`.
  Mais um caso: habilidade com custo 0 e cooldown 0 bloqueia o publish.

## Ordem e paralelismo

**M0 depende de você** (números e kit), mas não bloqueia M1–M3: as regras leem as constantes por
nome, e valores provisórios servem até a aprovação. M1 → M2 é sequencial (classe referencia arma).
**M3 e M4 andam em paralelo** depois de M2, em worktrees separados. M5 depende de M0 aprovado e de
M2. M6 e M7 fecham.

## Riscos

- **Upsert de habilidades:** o ponto de falha silenciosa da fase — se os ids mudarem a cada
  salvamento, o portão recusa toda v2. Teste dedicado em M2 é obrigatório.
- **Formulário de efeito com 13 variantes:** o maior bloco de UI. Dirigir os campos pelo schema
  (discriminated union) em vez de 13 formulários escritos à mão; `react-hook-form` com
  `zodResolver(EffectSchema)` já resolve a validação.
- **Kit sem as habilidades aprovadas:** sem M0 fechado, o kit importa classes vazias e a Fase 2
  fica testável só com classes feitas à mão. Fechar M0 cedo.
- **Campanhas já publicadas sem classes:** passam a falhar no portão de validação (`no_classes`)
  na próxima publicação. É o comportamento desejado (o plano da Fase 1 já previa) e adicionar
  classes é mudança aditiva, então a v2 delas passa no portão de compatibilidade.
