# Fase 1 — Autoria: plano detalhado

_Escopo de [spec §8](spec.md): CRUD de campanhas, editor de capítulos, editor do grafo de nós,
vilões com ataques, banco de perguntas, upload de mídia, fluxo de publicação._

## Objetivo e critério de pronto

Um autor logado consegue: criar uma campanha → montar um capítulo com grafo (entrada, batalhas,
chefe) → cadastrar vilões e perguntas → subir imagens → **publicar a v1** → editar → publicar a v2
aditiva (aceita) → tentar publicar uma v3 que deleta algo (**recusada, com lista de violações**).
O resultado é um `CampaignSnapshot` válido, que alimenta o protótipo vertical (Fase 3 antecipada).

## Fora do escopo (decisões a vetar)

- **Classes e habilidades** → Fase 1b. Publicar com `classes: []` é permitido na Fase 1; a 1b
  passa a exigir ao menos uma classe.
- **Itens e lojas** → Fase 4. Nós `shop` existem no grafo, mas com `itemIds: []`.
- **Vídeo** → Fase 5. `narrative.videoUrl` fica como campo de URL, sem upload.
- **Salas** → Fase 2.

## Decisões de design

1. **Rascunho tolera incompletude; publicação não.** Escritas no rascunho validam só a forma do
   campo (tipos, enums), então um nó de batalha sem vilão ainda é salvável. Completude é do
   _validation gate_ no publish. Sem isso o editor vira um formulário que não deixa salvar nada.
2. **Ids do rascunho = ids do snapshot** (cuid). O compatibility gate compara versões por id;
   regenerar ids no publish quebraria a comparação.
3. **Regras puras em um pacote novo `@rpg-chains/campaign-rules`** (depende só de `shared-types`
   e `game-config`): `validateDraft`, `checkCompatibility(prev, next)`, `draftToSnapshot`.
   Servidor e editor usam as mesmas funções (CLAUDE.md: reusar `isSinglePathNode` nos dois),
   e testam-se com fixtures JSON, igual ao motor. Alternativa: pôr em `apps/server` e duplicar a
   validação no web, o que eu descarto.
4. **Depois do primeiro publish, deletar entidade referenciável é recusado** (spec §2.2.1). Na UI,
   o botão de excluir de itens já publicados avisa antes, e o portão é a garantia real.
5. **Mídia:** URL pré-assinada de upload direto ao S3-compatível. R2 em produção, MinIO no
   `docker-compose` em dev. Sem tabela de mídia; os modelos guardam só a URL. Config via env
   (`env-schema.ts`), sem fallback.
6. **Web:** `@xyflow/react` para o grafo, TanStack Query para estado de servidor,
   react-hook-form + `zodResolver` reusando os schemas de `shared-types`, Tailwind para estilo.
   Escolhas padrão, vetáveis.
7. **API REST** em `routes/` como plugins por prefixo, com checagem de dono (`authorId`) em um
   preHandler compartilhado. Testes de contrato via `app.inject()` contra um banco de teste.

## Marcos

Cada marco entrega uma fatia vertical verificável. `[eu]` = fica comigo (invariantes);
`[delegável]` = mecânico, bom para executor barato com contrato de tarefa.

### M0 — Pré-requisitos

- [eu] Banco de teste (`rpg_chains_test`) + harness de `app.inject()` com sessão autenticada e
  limpeza entre testes.
- [delegável] Páginas de cadastro/login no web usando `auth-client.ts`, layout autenticado.
- [delegável] MinIO no `docker-compose` e novas vars no `env-schema.ts` + `.env.example`.
- [eu] Pacote `campaign-rules` vazio com scripts, ligado ao Turbo.

### M1 — Campanhas

- [delegável] `routes/campaigns.ts`: `GET/POST /api/campaigns`, `GET/PATCH/DELETE /:id`; só o
  autor enxerga e edita. Testes: 401, 403 ao tocar campanha alheia, CRUD feliz.
- [delegável] Web: lista, criar e editar campanha.

### M2 — Vilões e perguntas (entidades planas)

- [delegável] CRUD `/api/campaigns/:id/villains` e `/questions`. `Villain.attacks` valida com
  `VillainAttackSchema`; `Question` valida com `QuestionSchema` (objetiva exige opções e
  `correctIndex` dentro do intervalo; aberta não tem opções).
- [delegável] Web: formulário de vilão com editor de lista de ataques; banco de perguntas com
  filtro por tipo.
- Constantes de balanceamento, se surgirem, vão em `game-config`.

### M3 — Capítulos e grafo

- [delegável] CRUD de capítulos (nome, ordem, `underConstruction`) e de nós/arestas, com
  `PUT` do grafo inteiro numa transação (posição, tipo, `config`). Deletar nó remove arestas e
  referências em `prerequisites`, `entryNodeId` e `bossNodeId` (arestas não são FK).
- [eu] `validateDraft` em `campaign-rules`: entrada e chefe definidos, todo nó alcançável da
  entrada, chefe alcançável, sem ciclos, `participantLimit` e `recommendedLevel` em batalhas,
  pergunta aberta só em nó de caminho único (`isSinglePathNode`), ids referenciados existem.
  Retorna lista de problemas com caminho (`chapter.nodes[2].villainIds`).
- [delegável] Web: editor com `@xyflow/react` (arrastar nós, criar arestas, painel de propriedades
  por tipo) mostrando os problemas do `validateDraft` em tempo real.

### M4 — Upload de mídia

- [delegável] `POST /api/media/presign` (tipo/tamanho validados, chave com prefixo do usuário) e
  componente de upload usado por vilão. Só imagens, com limite de tamanho em `game-config` ou env.

### M5 — Publicação

- [eu] `draftToSnapshot`: tabelas normalizadas → `CampaignSnapshotSchema` (posição `posX/posY` →
  `position`, `config` jsonb achatado por tipo, capítulos em construção excluídos). Falha de
  parse do schema = publish recusado.
- [eu] `checkCompatibility(prev, next)` com a tabela da §2.2.1: aditivo e correções passam;
  deleção por id, mudança de atributos-base de classe, redução de vagas, remoção de habilidade e
  quebra de alcançabilidade do grafo são violações. Testes por regra, uma fixture por violação.
- [delegável] `POST /api/campaigns/:id/publish`: transação que roda os dois gates, calcula
  `version = última + 1` e grava `CampaignVersion.snapshot`. Resposta 422 com a lista de
  violações; `GET /versions` lista o histórico.
- [delegável] Web: tela de publicar com aviso do contrato no primeiro publish, lista de violações
  agrupada por regra e histórico de versões.

## Ordem e paralelismo

`M0 → M1 → M2` é sequencial (cada um reusa o padrão do anterior). Depois, **M3-web, M4 e o núcleo
de M5 (`draftToSnapshot` + `checkCompatibility`) podem andar em paralelo**, em worktrees
separados, porque M5-core só depende dos schemas e roda sobre fixtures JSON. Esse é o melhor
ponto para usar executores externos no que for `[delegável]`.

## Riscos

- **Compatibility gate:** é a parte mais fácil de errar em silêncio. Cobrir com um teste por linha
  da tabela §2.2.1, tanto o caso que passa quanto o que falha.
- **Salvar grafo inteiro por `PUT`:** simples e transacional, mas sobrescreve edição concorrente
  do mesmo autor em duas abas. Aceitável no MVP (um autor por campanha).
- **Deriva entre draft e snapshot:** qualquer coluna nova em `ChapterNode`/`Villain` precisa
  entrar em `draftToSnapshot`. Um teste de round-trip (draft → snapshot → parse) pega isso.
- **Migrations:** mudanças no `schema.prisma` passam pelo `migrate dev`; ações destrutivas exigem
  consentimento explícito do usuário (CLAUDE.md).
