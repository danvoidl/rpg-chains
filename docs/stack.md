# As Sete Correntes — Stack Tecnológica

_Documento de referência da stack e da arquitetura de monorepo para a Fase 0._

---

## 1. Princípios que guiam as escolhas

Três critérios ordenam todas as decisões abaixo, nesta prioridade: velocidade de iteração para um desenvolvedor solo, isolamento do que representa mais horas de trabalho (o motor de combate e o modelo de dados), e capacidade de escalar depois sem reescrita estrutural. A regra prática que resume tudo é adiantar a infraestrutura que resolve um problema que já existe e adiar a que resolve um problema que ainda não se sabe se vai existir.

A escolha de fundo é TypeScript em toda a stack. Sozinho, alternar entre linguagens no front e no back custa mais do que aparenta, e um único vocabulário de tipos permite compartilhar o formato de uma habilidade ou de um evento de batalha entre cliente e servidor sem duplicar nada.

---

## 2. Stack por camada

| Camada               | Tecnologia                | Papel                                                                              |
| -------------------- | ------------------------- | ---------------------------------------------------------------------------------- |
| **Frontend**         | Next.js (React)           | Visão do mestre, visão do jogador e editor de campanha no mesmo framework          |
| **Editor de grafo**  | React Flow                | Editor visual do grafo de capítulos (seção 2.3 da especificação)                   |
| **API REST**         | Fastify                   | CRUD de campanha, capítulos, vilões, classes, perguntas, autenticação              |
| **Tempo real**       | Socket.IO                 | Sala, sinal, rotação da campainha, julgamento do mestre; rooms e reconexão prontos |
| **Banco de dados**   | PostgreSQL                | Modelo relacional de todas as entidades da seção 2.1                               |
| **ORM**              | Prisma                    | Migração e type-safety com baixo atrito para dev solo                              |
| **Motor de combate** | Pacote TypeScript puro    | Lógica de combate sem dependência de I/O, testável isoladamente                    |
| **Validação**        | Zod                       | Schemas compartilhados que geram tipo e validação de runtime na borda do Socket.IO |
| **Object storage**   | Cloudflare R2 ou S3       | Imagens de vilão, arte de habilidade, vídeos de abertura de capítulo               |
| **Autenticação**     | Lucia Auth ou Better Auth | Sessão e hash de senha integrados ao Prisma, sem reinventar na mão                 |

---

## 3. Decisões-chave e justificativas

### 3.1 Motor de combate como pacote puro

O motor recebe estado mais evento e devolve novo estado, sem saber de onde o estado veio nem para onde vai. Esse isolamento é o que permite testar fila de iniciativa, empilhamento de efeitos e fórmula de dano com testes automatizados, sem simular conexão de socket nem subir banco. É também o que torna uma eventual migração de estado em memória para Redis uma troca na camada de fora, não uma reescrita do motor.

### 3.2 Versionamento por snapshot

O rascunho da campanha vive em tabelas normais do Postgres, editáveis livremente. Ao publicar, todo o conteúdo daquela versão — capítulos, nós, vilões, classes, habilidades, perguntas — é serializado num snapshot JSON imutável, salvo em `campanha_versoes`. A sala referencia esse snapshot, não as tabelas de rascunho, então o motor de combate nunca corre risco de ler uma edição posterior por engano, e os testes podem alimentá-lo com fixtures JSON puras sem precisar de banco.

### 3.3 Estado de batalha em memória no MVP

Com o tamanho de grupo previsto e poucas salas simultâneas, estado de batalha em memória num único processo Node é suficiente. Redis só entra quando houver necessidade de múltiplas instâncias do servidor, e a arquitetura já está desenhada para que essa troca seja localizada.

---

## 4. Hospedagem

Serverless fica descartado para o backend: funções serverless não seguram conexão WebSocket nem estado de batalha em memória entre chamadas, que é justamente o que a robustez ao vivo exige. Railway ou Fly.io atendem bem um dev solo, com processo Node de vida longa, Postgres gerenciado, deploy simples e custo baixo em fase de protótipo. O Next.js pode rodar no mesmo serviço, evitando split com a Vercel e reduzindo peças a gerenciar.

---

## 5. Estrutura de monorepo

Gerenciado com pnpm workspaces e Turborepo. Turborepo entrega cache incremental de build e teste e execução paralela respeitando dependências entre pacotes, com pouca configuração — Nx só se justificaria com um time maior precisando de geradores de código padronizados. O protocolo `workspace:*` do pnpm garante que os apps sempre resolvam a versão local dos pacotes, nunca uma publicada.

```
as-sete-correntes/
├── apps/
│   ├── web/                    # Next.js (cliente)
│   └── server/                 # Fastify + Socket.IO (API + tempo real)
├── packages/
│   ├── battle-engine/          # lógica pura de combate, testes exaustivos
│   ├── shared-types/           # Zod schemas + tipos derivados
│   ├── game-config/            # constantes de balanceamento
│   ├── eslint-config/          # regras de lint compartilhadas
│   └── tsconfig/               # tsconfig base compartilhado
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### 5.1 Regra de dependência

Dependência é uma via de mão única: `apps/*` pode depender de `packages/*`; `packages/*` nunca depende de `apps/*`; e dentro de `packages/*`, `battle-engine` não pode depender de nada que fale com banco, socket ou HTTP. Essa regra é o que preserva a testabilidade do motor de combate ao longo do tempo, mesmo que o resto da stack mude.

### 5.2 Configuração entre pacotes

TypeScript project references (não apenas path aliases) para build incremental real e detecção de importação circular em tempo de compilação. Husky mais lint-staged no pre-commit para rodar lint e format nos arquivos alterados. Arquivos `.env` por app, nunca na raiz, para não vazar segredo de banco para o bundle do frontend.

---

## 6. Estratégia de testes

O nível de teste é proporcional à densidade de regra de negócio e ao custo de testar cada parte, o que é decisão consciente e não falta de rigor.

O `battle-engine` recebe cobertura exaustiva de testes unitários com fixtures JSON de estados de batalha, por concentrar a lógica mais densa e ser a mais barata de testar isolada. O `apps/server` recebe testes de integração nos handlers de Socket.IO e testes de contrato nas rotas REST. O `apps/web` recebe testes de componente pontuais nos fluxos críticos, sem perseguir cobertura total de UI. Um único fluxo de ponta a ponta — criar sala, entrar, vencer uma batalha simples — é automatizado com Playwright para validar que a stack inteira ainda conversa.

Na integração contínua, o pipeline valida apenas o que mudou em cada PR, em vez da monorepo inteira a cada commit.

---

## 7. Pendências de infraestrutura a fechar antes de escalar

Object storage para mídia e biblioteca de autenticação são peças que precisam entrar no planejamento antes das fases que dependem delas — imagens já na Fase 1, vídeo e CDN antes da Fase 5. Load testing, monitoramento de produção e backup automatizado do Postgres são trabalho de quando houver usuários reais, não da Fase 0, e adiantá-los agora seria o mesmo erro de pagar por um problema que ainda não existe.
