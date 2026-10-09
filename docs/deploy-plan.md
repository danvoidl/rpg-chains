# Plano de deploy — Render + Neon + Cloudflare R2

Plano para levar o rpg-chains do deploy de playtest da Fase 6 (Render gratuito, Neon, mídia
desligada — [phase-6-playtest.md](phase-6-playtest.md)) a um deploy de **produção**: domínio
próprio, mídia no R2, homologação separada, CI antes do deploy e deploys que não quebram batalha
em andamento.

Valores de preço e cota dos provedores mudam com frequência: os citados aqui são referência e
devem ser conferidos no painel de cada um no momento da contratação.

## 1. Arquitetura alvo

```
                   navegador (celular / desktop)
                     │                       │
        https://app.<domínio>        https://media.<domínio>
                     │                       │
        ┌────────────▼────────────┐   ┌──────▼──────────────┐
        │ Render — web service    │   │ Cloudflare R2       │
        │ (Docker, 1 instância)   │   │ bucket público      │
        │  Caddy :$PORT           │   │ (leitura via domínio│
        │   ├ /api, /socket.io,   │   │  custom; escrita só │
        │   │ /health → API :3001 │   │  por URL pré-assinada)
        │   └ resto → Next :3000  │   └──────▲──────────────┘
        └────────────┬────────────┘          │ PUT pré-assinado
                     │ TLS (sslmode=require) │ (o navegador sobe direto)
              ┌──────▼──────┐                │
              │ Neon        │      API assina a URL (S3 API do R2)
              │ Postgres 17 │
              └─────────────┘
```

O que **não muda** em relação ao playtest, e por quê:

- **Uma imagem, um serviço, uma origem.** Caddy reparte `/api`, `/socket.io` e `/health` para a
  API e o resto para o Next (`deploy/Caddyfile`). Página, cookie do Better Auth e socket ficam na
  mesma origem — sem cookie entre sites, que navegadores de celular bloqueiam.
- **Uma instância só.** Batalhas vivem na memória do processo (spec §3.7); o diário de batalha
  serve só para voltar depois de um reinício. Escalar horizontalmente exigiria afinidade por
  batalha e não está no escopo. Escalar é **vertical** (instância maior).
- **Serverless descartado** para o backend (stack §4): WebSocket e estado em memória pedem
  processo de vida longa.

O que **muda**:

| Item         | Playtest (hoje)             | Produção (alvo)                                        |
| ------------ | --------------------------- | ------------------------------------------------------ |
| Plano Render | Free (hiberna em 15 min)    | Starter ou superior (sempre ligado, pre-deploy)        |
| Endereço     | `*.onrender.com`            | `app.<domínio>` (DNS na Cloudflare)                    |
| Mídia        | desligada (placeholders)    | R2, leitura em `media.<domínio>`                       |
| Migrations   | no boot (`deploy/start.sh`) | `preDeployCommand` do Render (falha → deploy não sobe) |
| Deploy       | manual, só com sala parada  | automático após CI verde, fora do horário das sessões  |
| Ambientes    | um                          | homologação (`develop`) + produção (`main`)            |
| Banco        | um projeto Neon             | um projeto, branch `production` + branch `staging`     |

## 2. Pré-requisitos (contas e domínio) — responsabilidade do usuário

1. **Domínio** registrado e com o DNS na **Cloudflare** (necessário para o domínio custom do R2;
   também serve para o app). Registrar pela própria Cloudflare simplifica.
2. **Cloudflare**: R2 habilitado (pede cartão para verificação, mesmo no gratuito).
3. **Render**: conta ligada ao GitHub, com cartão (planos pagos).
4. **Neon**: conta e projeto (o plano gratuito serve no início; ver §5.4).
5. **GitHub**: repositório `rpg-chains` com `main` e `develop`.

Nomes sugeridos (usados no resto do documento):

| Recurso                | Produção                  | Homologação                       |
| ---------------------- | ------------------------- | --------------------------------- |
| Serviço Render         | `rpg-chains`              | `rpg-chains-staging`              |
| Endereço do app        | `https://app.<domínio>`   | `https://staging.<domínio>`       |
| Branch Neon            | `production`              | `staging`                         |
| Bucket R2              | `rpg-chains-media`        | `rpg-chains-media-staging`        |
| Domínio público R2     | `https://media.<domínio>` | `https://media-staging.<domínio>` |
| Branch Git que publica | `main`                    | `develop`                         |

## 3. Mudanças de código antes do primeiro deploy de produção

Cada item é pequeno e independente; todos passam pela homologação antes de `main`.

### 3.1 Cliente S3 compatível com o R2 (obrigatório para mídia)

`@aws-sdk/client-s3` instalado é a 3.1146. Desde a 3.729 o SDK acrescenta checksums CRC32 por
padrão às requisições — e, numa URL pré-assinada, o checksum é calculado sobre um corpo vazio, de
modo que o `PUT` do navegador com o arquivo real é recusado. A documentação do R2 recomenda
desligar o checksum automático. Em `apps/server/src/storage.ts`:

```ts
export const s3 = new S3Client({
  // …campos atuais…
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});
```

O RustFS do dev aceita os dois modos, então a mudança não quebra o ambiente local. Conferir na
homologação: subir imagem e vídeo pelo editor e abrir a URL pública.

### 3.2 Deploy com batalha rodando (adiado)

**Decisão (2026-10-09): por enquanto não tratamos deploy com batalha rodando.** O Render faz deploy
**sem downtime**: sobe o processo novo e só derruba o antigo quando o novo responde ao health
check. Se houver batalha rodando nesse intervalo, o novo a restaura do diário enquanto o antigo
ainda a joga; os dois disputam o diário e o write-back pode acontecer duas vezes (XP/ouro em dobro
ou perdido). Risco aceito: deployar a produção fora do horário das sessões.

Quando isso passar a importar, há duas saídas:

- **Disco persistente.** O Render desliga o deploy sem downtime em serviços com disco: para o
  antigo (SIGTERM → `preClose` grava o diário) e só então sobe o novo, que restaura as batalhas
  pausadas. Custo: um disco de 1 GB que nem precisa ser usado, e ~30–60 s fora do ar por deploy.
  É só acrescentar um bloco `disk` ao serviço no `render.yaml`.
- **"Dono" do diário no banco.** Uma linha de lease (`holderId`, `expiresAt`) renovada por
  batimento; `battle-restore` só restaura quando o lease anterior expirou ou foi solto no
  `preClose`, e o processo antigo para de aceitar comandos ao perder o lease. Mantém o deploy sem
  downtime, mas é trabalho de fase (testes de restart em dobro no estilo de
  `battle-restart.test.ts`).

O `maxShutdownDelaySeconds: 60` do `render.yaml` já dá tempo para o `preClose` gravar o diário
num reinício comum.

### 3.3 Migrations fora do boot

Hoje `deploy/start.sh` roda `prisma migrate deploy` na subida porque o plano gratuito não tem
passo de release. Nos planos pagos, usar o **`preDeployCommand`** do Render: se a migration
falhar, o deploy aborta e a versão antiga continua no ar (no boot, uma migration quebrada derruba
o serviço). Proposta: `start.sh` só migra quando `MIGRATE_ON_BOOT=true` (mantido no serviço de
homologação se ele ficar no plano gratuito); a produção migra no pre-deploy.

Regra de escrita de migrations a partir daqui: **expandir antes de contrair**. Uma migration
precisa ser compatível com o código da versão anterior durante a janela do deploy (adicionar
coluna nula/tabela nova: ok; renomear/remover coluna: em dois deploys).

### 3.4 IP do cliente atrás dos proxies

A API não lê `req.ip` em lugar nenhum; quem precisa do IP é o **rate limit do Better Auth**.
Atrás do Render (Cloudflare → Render → Caddy) o `X-Forwarded-For` chega com vários saltos, e o
Better Auth 1.7 só confia num cabeçalho de valor único — sem IP, o rate limit fica sem chave. O
Render passa pela Cloudflare, que põe o IP real em `CF-Connecting-IP` (valor único, sobrescrito
por ela). Em `apps/server/src/auth.ts`: `advanced.ipAddress.ipAddressHeaders:
['cf-connecting-ip', 'x-forwarded-for']` — fora do Render o primeiro não existe e vale o
segundo. (`trustProxy` do Fastify não muda nada aqui e ficou de fora.) Testar na homologação:
duas pessoas errando a senha não podem bloquear uma à outra.

### 3.5 CI no GitHub Actions

Não existe `.github/workflows`. Criar `ci.yml` (push e PR em `develop` e `main`):

1. `pnpm install --frozen-lockfile` (com `pnpm/action-setup` e cache).
2. `prisma generate` (lab note: o install não gera o client).
3. Serviço Postgres 17 no job; `TEST_DATABASE_URL` apontando para ele.
4. `pnpm turbo run build typecheck lint test`.
5. (Opcional, job separado e mais lento) e2e Playwright.

O Render passa a publicar só com CI verde (`autoDeployTrigger: checksPass`).

### 3.6 Opcional: endereço da API relativo

`NEXT_PUBLIC_API_URL` é embutido no bundle no build (`apps/web/src/lib/config.ts`), por isso
trocar de domínio exige rebuild. Como API e web estão na mesma origem, o cliente poderia usar
caminhos relativos (`/api/...`) e o socket `io()` sem URL. Não é bloqueante: basta lembrar que
**mudar domínio = novo deploy**, não só reiniciar.

### 3.7 Opcional: imagem menor

O `Dockerfile` copia o monorepo inteiro e mantém devDependencies (~build lento, imagem grande).
Melhoria futura: multi-stage com `pnpm deploy --prod` para a API e `output: 'standalone'` no
Next. Não muda comportamento; reduz tempo de build e de cold start.

## 4. Cloudflare R2

### 4.1 Buckets

Painel Cloudflare → R2 → **Create bucket**: `rpg-chains-media` (produção) e
`rpg-chains-media-staging`. Localização automática (ou dica "Eastern North America", perto do
Render Virginia — afeta só a latência do upload; a leitura pública passa pelo cache da
Cloudflare).

### 4.2 Leitura pública via domínio custom

Bucket → Settings → **Custom Domains** → `media.<domínio>` (e `media-staging.<domínio>` no outro).
A Cloudflare cria o registro DNS e o certificado. **Não usar o `pub-….r2.dev` em produção**: ele
tem limite de taxa e não passa pelo cache. Deixar o acesso `r2.dev` desligado.

Opcional: regra de cache na zona para `media.<domínio>/*` com TTL longo — as chaves de upload já
são únicas (não há sobrescrita), então cache agressivo é seguro.

### 4.3 CORS do bucket (upload direto do navegador)

Bucket → Settings → CORS policy:

```json
[
  {
    "AllowedOrigins": ["https://app.<domínio>"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

Na homologação, a origem é `https://staging.<domínio>`. Nunca `*` em produção (o dev local usa
`*` só no RustFS).

### 4.4 Credenciais

R2 → **Manage API Tokens** → Create token, permissão **Object Read & Write**, restrito ao bucket
do ambiente (um token por ambiente). Guardar `Access Key ID` e `Secret Access Key` direto no
Render; anotar o **Account ID** para o endpoint.

| Variável               | Valor                                           |
| ---------------------- | ----------------------------------------------- |
| `S3_ENDPOINT`          | `https://<account-id>.r2.cloudflarestorage.com` |
| `S3_REGION`            | `auto`                                          |
| `S3_BUCKET`            | `rpg-chains-media` / `rpg-chains-media-staging` |
| `S3_ACCESS_KEY_ID`     | do token do ambiente                            |
| `S3_SECRET_ACCESS_KEY` | do token do ambiente                            |
| `S3_FORCE_PATH_STYLE`  | `true`                                          |
| `S3_PUBLIC_BASE_URL`   | `https://media.<domínio>` (sem barra final)     |

### 4.5 Pendências conhecidas da mídia (não bloqueiam)

- **Uploads órfãos**: uma imagem enviada e depois trocada no editor fica no bucket para sempre.
  Mais tarde: varredura que compara chaves do bucket com as URLs referenciadas em rascunhos e
  versões publicadas (as versões são imutáveis — **nunca** apagar mídia referenciada por uma
  versão publicada).
- O limite de tamanho já é imposto pela assinatura (`ContentLength` assinado,
  `MEDIA_MAX_UPLOAD_BYTES` / `MEDIA_MAX_VIDEO_BYTES`).

## 5. Neon

### 5.1 Projeto e região

Um projeto `rpg-chains`, Postgres 17 (o mesmo do `docker-compose.yml`), região **AWS US East
(N. Virginia)** — a mesma do Render. A latência banco↔app importa mais que a do usuário: cada
write-back e cada rota faz várias idas ao banco.

### 5.2 Branches

- Renomear a branch padrão para `production` (o banco do playtest pode ser reaproveitado ou
  recriado — decidir se as contas do playtest devem sobreviver).
- Criar `staging` a partir de `production`. Para ensaiar uma migration arriscada, criar uma
  branch descartável de `production`, aplicar `prisma migrate deploy` nela e apagá-la.

### 5.3 Conexão

- Usar a connection string **direta** (sem `-pooler`) em `DATABASE_URL`, com
  `?sslmode=require`. Motivo: o servidor é um processo longo com o pool do `pg`; o PgBouncer do
  Neon não traz ganho para uma instância só, e o `prisma migrate deploy` exige conexão direta.
- Um **role por ambiente** (`app_production`, `app_staging`), cada um dono só do seu banco.

### 5.4 Plano, pausa e backups

- O compute do Neon **suspende após alguns minutos sem uso** e acorda na primeira conexão
  (centenas de ms). Com o serviço do Render sempre ligado e o pool do `pg` aberto, quase nunca
  suspende em produção; na homologação, o primeiro acesso do dia fica mais lento — aceitável.
- **Backups**: o Neon guarda histórico para restauração a um ponto no tempo; a janela depende do
  plano (curta no gratuito). Ao ter usuários reais, migrar para um plano pago com janela de pelo
  menos 7 dias. Complementar com um `pg_dump` periódico (GitHub Actions agendado) para um bucket
  R2 privado `rpg-chains-backups`.
- Ensaiar a restauração uma vez antes do lançamento (restaurar numa branch, apontar a homologação
  para ela, conferir login e uma sala).

## 6. Render

### 6.1 Blueprint

O [`render.yaml`](../render.yaml) define os dois serviços: `rpg-chains` (produção: Starter, branch
`main`, `preDeployCommand` com as migrations, `MIGRATE_ON_BOOT=false`) e
`rpg-chains-staging` (gratuito, branch `develop`, `MIGRATE_ON_BOOT=true`). Ambos com uma
instância, `autoDeployTrigger: checksPass` e `maxShutdownDelaySeconds: 60`. Valores
`sync: false` (URLs, `DATABASE_URL`, credenciais e endpoint do R2) são preenchidos no painel;
nada secreto no repositório.

O serviço de playtest atual (`rpg-chains-playtest`) não está mais no Blueprint: ao sincronizar,
o Render cria os dois serviços novos e o antigo fica órfão. Apagar o antigo no painel depois que
a homologação estiver de pé.

Observações:

- **`NEXT_PUBLIC_API_URL` entra no build** (`ARG` no `Dockerfile`). O Render repassa as variáveis
  do serviço como build args; trocar o valor exige **novo deploy**, não restart.
- `BETTER_AUTH_SECRET` gerado uma vez e nunca trocado sem querer (trocar desloga todo mundo).
  Nunca reaproveitar o da homologação.
- `BATTLE_SEED` **não** existe em nenhum ambiente publicado (é só do e2e).

### 6.2 Domínio do app

Render → serviço → Settings → **Custom Domains** → `app.<domínio>`. Na Cloudflare, `CNAME app →
rpg-chains.onrender.com` com proxy **desligado** (nuvem cinza, "DNS only") — o Render emite o
certificado e o WebSocket vai direto. (Ligar o proxy laranja também funciona com SSL "Full
(strict)", mas acrescenta uma camada a depurar; deixar para depois, se precisar de WAF.)

Depois do domínio verificado: deixar o `*.onrender.com` só como fallback — **todas** as variáveis
de URL apontam para o domínio custom, porque o cookie e o CORS só aceitam uma origem
(`WEB_ORIGIN`).

### 6.3 Plano e recursos

- Medido no playtest: ~250 MB com uma batalha. O Starter (512 MB) cabe para o início; acompanhar a
  métrica de memória do Render com várias salas e subir para o próximo plano antes de 75%.
- Região Virginia: ~120–150 ms do Brasil. O Render não tem região na América do Sul; se a disputa
  do sinal sofrer com latência, a alternativa é outro provedor — fora deste plano.

## 7. Homologação e primeiro deploy (passo a passo)

### Etapa 1 — Código (em `develop`)

1. §3.1 cliente S3, §3.3 migrate condicional, §3.4 IP do cliente, §3.5 CI, `render.yaml` novo.
2. `pnpm turbo run build typecheck lint test` local verde; push; CI verde.

### Etapa 2 — Infra de homologação

1. Neon: branch `staging`, role, connection string.
2. R2: bucket staging, domínio `media-staging`, CORS, token.
3. Cloudflare DNS: `staging` CNAME para o serviço de homologação.
4. Render: aplicar o Blueprint (cria os dois serviços); preencher os `sync: false` da homologação.
5. Esperar o build; `GET https://staging.<domínio>/health` → `{"status":"ok"}`.

### Etapa 3 — Checklist de homologação

| #   | Verificação                                                              | Esperado                                      |
| --- | ------------------------------------------------------------------------ | --------------------------------------------- |
| 1   | Criar conta e logar pelo celular (4G)                                    | cookie aceito, sessão mantida ao recarregar   |
| 2   | DevTools → aba Network → socket                                          | `wss://staging.<domínio>/socket.io/…`, 101    |
| 3   | Editor: subir imagem de vilão e vídeo de abertura                        | PUT 200 no R2; imagem abre em `media-staging` |
| 4   | Publicar campanha, criar sala, entrar com 2 aparelhos, jogar uma batalha | fluxo completo, write-back de XP/ouro         |
| 5   | Migration de teste (coluna nula) num push                                | aplicada antes do processo novo subir         |
| 6   | Migration que falha de propósito (numa branch descartável)               | deploy aborta, versão antiga continua no ar   |
| 7   | Login errado repetido de dois IPs diferentes                             | rate limit por IP, não global (§3.4)          |
| 8   | Restaurar backup do Neon numa branch e apontar a homologação             | dados íntegros                                |

### Etapa 4 — Produção

1. Neon `production`, R2 produção, DNS `app` e `media`, variáveis do serviço `rpg-chains`.
2. Merge `develop → main` (PR). CI verde → Render faz build, pre-deploy (migrations) e sobe.
3. Repetir os itens 1–4 do checklist em produção com uma conta de teste.
4. Se o banco do playtest foi reaproveitado, conferir as contas e salas antigas.

## 8. Operação

### 8.1 Fluxo de entrega

`feature → develop` (homologação publica sozinha após CI) → teste manual → PR `develop → main`
(produção publica após CI). Merge na `main` só fora do horário das sessões: um deploy com batalha
rodando pode duplicar ou perder recompensas (§3.2).

### 8.2 Rollback

- **Código**: Render → Deploys → **Rollback** para o deploy anterior (a imagem antiga sobe sem
  rebuild). Só é seguro se a migration do deploy desfeito for aditiva (regra de §3.3).
- **Banco**: restauração a um ponto no tempo do Neon numa branch nova; apontar `DATABASE_URL` para
  ela e redeployar. Último recurso — perde o que foi escrito depois do ponto.
- **Mídia**: objetos nunca são sobrescritos (chaves únicas); nada a reverter.

### 8.3 Observabilidade

- Logs do Render (Fastify loga em JSON com `logger: true`); configurar um **log stream** para um
  serviço externo se precisar de retenção maior.
- Health check `/health` (já usado pelo Render para reiniciar o serviço).
- Monitor externo de disponibilidade (ex.: UptimeRobot) em `https://app.<domínio>/health`, com
  alerta por e-mail.
- Alertas do Render para falha de deploy e uso de memória.
- Futuro: rastreamento de erros (Sentry ou similar) na web e na API.

### 8.4 Segurança

- Segredos só nas variáveis do Render; `.env` nunca no repositório (já no `.dockerignore`).
- Tokens R2 por bucket; role Neon por ambiente; rotação anual ou quando alguém sair do projeto.
- CORS (API, socket e R2) restrito à origem do ambiente.
- Proteção da branch `main` no GitHub: PR obrigatório e CI verde.

### 8.5 Custos de referência (conferir antes de contratar)

| Item                      | Início                                                         |
| ------------------------- | -------------------------------------------------------------- |
| Render produção (Starter) | ~US$ 7/mês                                                     |
| Render homologação        | gratuito (hiberna) ou Starter                                  |
| Neon                      | gratuito no início; pago ao ter usuários (backups mais longos) |
| Cloudflare R2             | 10 GB e egress gratuitos; acima disso, por GB armazenado       |
| Domínio                   | ~US$ 10–15/ano                                                 |

## 9. Ordem resumida

1. [usuário] Domínio na Cloudflare, R2 habilitado, Render com cartão, Neon.
2. [código] §3.1, §3.3, §3.4, §3.5 e o novo `render.yaml` em `develop`.
3. [infra] Homologação: Neon `staging`, R2 staging, DNS, Blueprint.
4. [teste] Checklist §7 Etapa 3.
5. [infra] Produção: Neon `production`, R2, DNS, variáveis.
6. [entrega] PR `develop → main`, checklist em produção.
7. [depois] §3.2 (deploy com batalha rodando), imagem menor, limpeza de mídia órfã, backups externos.
