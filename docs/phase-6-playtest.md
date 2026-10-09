# Playtest da Fase 6 — robustez ao vivo

Roteiro do playtest que fecha a Fase 6 (plano da Fase 6, M8). Objetivo: jogar **numa rede de
verdade** e provocar de propósito o que a fase trata. Quedas de conexão, celular em segundo
plano, recarregar a página e o servidor reiniciar. A pergunta é sempre a mesma: **alguém perdeu
progresso, ou caiu da batalha, sem entender por quê?** Combate, economia e trilha já foram
playtestados nas Fases 3–5; aqui eles só servem de meio.

O jogo roda no **plano gratuito do Render**. O banco fica no **Neon** (gratuito, sem cartão). O
Postgres gratuito do Render expira em 30 dias, por isso não é usado. Nada disso pede cartão. A
mídia (upload de imagem e vídeo) fica desligada: o seed do playtest não usa mídia (veja "Mídia
(opcional)" no fim).

## Como o deploy funciona

Uma imagem só (`Dockerfile`), num serviço só do Render:

- **Caddy** recebe tudo na porta pública (`PORT`, 10000) e reparte: `/api/*`, `/socket.io/*` e
  `/health` vão para a API (Fastify, porta 3001); o resto vai para a web (Next, porta 3000)
  (`deploy/Caddyfile`).
- Página, cookie de login e socket ficam no **mesmo endereço**. Sem isso, o navegador do celular
  bloquearia o cookie entre dois domínios (risco aberto desde a Fase 2).
- Na subida, `deploy/start.sh` aplica as migrations (`prisma migrate deploy`) e sobe os três
  processos.
- **Uma instância só.** As batalhas vivem na memória do processo. O diário de batalha é só a cópia
  para voltar depois de um reinício (spec §3.7).

Limites do plano gratuito, conferidos com a imagem rodando localmente com 512 MB e 0,1 de CPU:

| O quê         | Valor                                                                         |
| ------------- | ----------------------------------------------------------------------------- |
| Memória       | ~250 MB com uma batalha rodando (de 512 MB)                                   |
| Subida a frio | ~30–35 s com 0,1 de CPU, mais ~1 min do Render para acordar o serviço         |
| Hibernação    | 15 min sem nenhuma requisição nem mensagem de socket; uma aba aberta já basta |
| Horas por mês | 750 (o serviço ligado o mês inteiro usa 720)                                  |
| Região        | Virginia (EUA): ~120–150 ms de ida e volta a partir do Brasil                 |

Quando o serviço hiberna e acorda, é um reinício de servidor como outro qualquer. Uma batalha que
estivesse rodando volta do diário, pausada, e continua quando alguém reconecta.

## Preparação (uma vez, ~30 min)

### 1. Código no GitHub

O Render faz o deploy a partir do repositório. Commite e envie a branch com a Fase 6 (`develop`)
para o GitHub. O Render precisa enxergar `Dockerfile`, `deploy/` e `render.yaml`.

### 2. Banco no Neon

1. Crie uma conta em [neon.com](https://neon.com) e um projeto. Escolha a região **AWS US East
   (N. Virginia)**, a mesma do Render.
2. Em **Connect**, copie a connection string **sem pooling** (desmarque "Connection pooling"). O
   `prisma migrate deploy` precisa da conexão direta. Ela termina em `?sslmode=require`; mantenha.

### 3. Serviço no Render

1. Crie uma conta em [render.com](https://render.com) (pode entrar com o GitHub) e autorize o
   acesso ao repositório `rpg-chains`.
2. **New → Blueprint**, escolha o repositório e a branch `develop`. O Render lê o `render.yaml` e
   mostra um serviço `rpg-chains-playtest` (Docker, plano Free, Virginia).
3. Ele pede os valores marcados `sync: false`. O endereço do serviço será
   `https://rpg-chains-playtest.onrender.com`. Se o nome já estiver em uso, o Render acrescenta um
   sufixo; use o endereço que ele mostrar.

| Variável               | Valor                                                                 |
| ---------------------- | --------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`  | o endereço do serviço, ex. `https://rpg-chains-playtest.onrender.com` |
| `BETTER_AUTH_URL`      | o mesmo endereço                                                      |
| `WEB_ORIGIN`           | o mesmo endereço                                                      |
| `DATABASE_URL`         | a connection string do Neon (passo 2)                                 |
| `S3_ENDPOINT`          | `https://media.invalid` (sem mídia; veja o fim)                       |
| `S3_BUCKET`            | `none`                                                                |
| `S3_ACCESS_KEY_ID`     | `none`                                                                |
| `S3_SECRET_ACCESS_KEY` | `none`                                                                |
| `S3_PUBLIC_BASE_URL`   | `https://media.invalid/none`                                          |

`BETTER_AUTH_SECRET` é gerado pelo Render. `PORT`, `S3_REGION`, `S3_FORCE_PATH_STYLE` e os
limites de mídia já vêm no `render.yaml`.

4. Aplique. O primeiro build leva ~5–10 min (instala o monorepo e compila a web).
5. Se o endereço final saiu diferente do que você pôs nas três primeiras variáveis, corrija as
   três e faça **Manual Deploy → Deploy latest commit**. A web guarda o endereço no build, então
   só corrigir e reiniciar não basta.
6. Confira: `https://<seu-serviço>.onrender.com/health` responde `{"status":"ok"}`.

O deploy automático a cada commit está desligado (`autoDeployTrigger: off`), para um push não
reiniciar o servidor no meio do playtest. Para atualizar, use **Manual Deploy**, e só com
nenhuma batalha rodando (veja os limites).

### 4. Campanha do playtest

1. O mestre abre o endereço do serviço e cria a conta pela web.
2. No seu computador, gere a campanha **no banco do Neon**. A variável da linha de comando vence o
   `.env`:

   ```bash
   DATABASE_URL='<connection string do Neon>' pnpm --filter @rpg-chains/server seed:playtest <e-mail do mestre>
   ```

3. O mestre cria uma sala **pública** a partir de "Playtest Fase 5". É a mesma campanha da Fase 5:
   dois capítulos, só perguntas objetivas.
4. Os jogadores entram **pelo celular, no 4G** (Wi-Fi desligado), e escolhem classe. Pelo menos
   um jogador no computador, para comparar.

Antes de começar, abra o endereço uma vez ~2 min antes, para o serviço acordar (a primeira
abertura mostra a tela de carregamento do Render).

## Roteiro

O que a fase prometeu (spec §3.2, §3.3, §3.7, §7):

- **Queda não é saída.** Quem cai tem **60 s** (`RECONNECT_GRACE_MS`) para voltar à mesma
  batalha. Enquanto está fora, aparece "sem conexão" no cartão. Não toca o sinal, mas continua
  sendo alvo.
- **Grupo inteiro fora → a batalha pausa**, e os inimigos também não agem. O primeiro que volta
  retoma.
- **"Sair da batalha"** (botão) é sair de vez: sem recompensa, e se o grupo perder, perde ouro
  como os outros.
- **Servidor reiniciado:** a batalha volta pausada. Se ninguém reconectar em 60 s, ela é
  cancelada sem custo.
- **Cancelar** uma batalha rodando é do mestre. Sem ele, todos os conectados precisam "Pedir
  para cancelar" em 30 s. O mestre também pode **Reiniciar**.

Cada passo provoca uma coisa. Anote o que cada um viu na tela.

1. **Recarregar.** No meio de uma batalha, um jogador recarrega a página. Ele deve voltar à mesma
   batalha em poucos segundos. Os outros podem ver "perdeu a conexão" e "reconectou" no feed.
2. **Trocar de app.** No celular, um jogador sai do navegador (WhatsApp, câmera) por ~20 s e volta.
   Ele deve continuar dentro da batalha, sem precisar fazer nada.
3. **Modo avião curto.** Um jogador liga o modo avião por ~10 s **na vez dele** (depois de ganhar
   o sinal) e desliga. Duas coisas valem: se ele voltar a tempo, responde; se não, o turno se
   perde. Mas ele **continua na batalha** e aparece a faixa "Sem conexão — reconectando…".
4. **Modo avião longo.** Um jogador fica em modo avião por **mais de 1 minuto**. Ele deve sair da
   batalha ("saiu" no cartão). Ao voltar, assiste, mas não luta mais nela.
5. **Ir à sala e voltar.** Um jogador vai para a sala no meio da batalha e volta por "Voltar à
   batalha" no cartão, em menos de 1 min.
6. **Todo mundo fora.** Numa batalha pequena, todos fecham a aba ou ligam o modo avião juntos por
   ~30 s. A batalha deve pausar: ao voltar, ninguém apanhou nesse meio-tempo.
7. **Reinício do servidor.** Com uma batalha rodando, alguém usa **Settings → Suspend Web
   Service** no painel do Render e, logo depois, **Resume**. O processo para de vez e sobe de
   novo (~1–2 min). As páginas reconectam sozinhas e a batalha continua do ponto em que estava,
   pausada até alguém voltar. **Não use Manual Deploy para isso** (veja os limites).
8. **Reiniciar e cancelar.** O mestre usa "Reiniciar" numa batalha: todos voltam para uma formação
   nova no mesmo nó. Depois, com o mestre **fora da sala** (aba fechada há mais de 1 min), os
   jogadores tentam cancelar uma batalha. Um só pedindo não basta; todos pedindo, cancela.
9. **Sair de propósito.** Um jogador usa "Sair da batalha". O resto do grupo segue; se perderem,
   ele também perde ouro.
10. **Hibernação.** No fim, todos fecham tudo por **mais de 15 min** e voltam. A primeira abertura
    leva ~1–2 min (o serviço acorda). Depois, a sala está como estava: progresso, ouro, nível e
    ofertas de troca pendentes.

### Mestre e pergunta aberta (opcional)

O seed só tem perguntas objetivas. Para testar a graça do mestre, o autor acrescenta, no editor,
uma pergunta aberta a uma batalha de caminho único, publica, e o grupo forma essa batalha. Então:

- o mestre **recarrega** a página enquanto escolhe a pergunta → nada muda (continua esperando por
  ele);
- o mestre fecha a aba por **mais de 1 min** → a batalha passa às perguntas objetivas do nó, ou
  pausa se não houver.

## Limites conhecidos (não anotar como bug)

- **Nada de deploy com batalha rodando.** O Render faz deploy sem downtime: sobe o processo novo
  e só para o antigo quando o novo já responde. Nesse intervalo, os dois teriam a mesma batalha:
  o novo a restaura do diário enquanto o antigo ainda a joga. Faça **Manual Deploy** só com a sala
  parada. Para reiniciar no meio de uma batalha, use Suspend/Resume.

- **Primeira abertura lenta:** o serviço gratuito dorme depois de 15 min e leva ~1 min para
  acordar, mais ~30 s para subir com 0,1 de CPU.
- **Latência:** o servidor está nos EUA. O sinal é disputado pela ordem de chegada no servidor,
  então quem tem a internet mais lenta toca um pouco depois. Anote se alguém achar injusto.
- **Pergunta nova depois de uma pausa:** quando a batalha retoma, a pergunta sorteada é outra (o
  baralho anda).
- **Sem upload de mídia:** com os valores de exemplo, enviar imagem ou vídeo falha. O jogo não
  precisa disso.
- **O mestre no lobby:** a lista de "online" da sala muda na hora. A batalha só considera o mestre
  ausente depois de 1 min.
- **Tempos do turno:** ainda são os da plataforma, com o ajuste do mestre. Os tempos definidos
  pela campanha ficaram para depois (M7).

## O que observar e anotar

| Pergunta                                                                                    | Onde ajustar                                     |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Alguém caiu da batalha sem ter saído de propósito? Em que passo, em que aparelho?           | registrar o caso (quem, o que fez, quanto tempo) |
| 60 s de graça é pouco ou muito? Alguém voltou e já tinha saído?                             | `RECONNECT_GRACE_MS` (`game-config`)             |
| A faixa "Sem conexão — reconectando…" apareceu quando devia? Some sozinha ao voltar?        | `features/rooms/connection-banner.tsx`           |
| O selo "sem conexão" no cartão deixou claro quem caiu?                                      | `features/battles/combatant-card.tsx`            |
| A pausa com todos fora pareceu certa? Alguém estranhou a pergunta nova ao retomar?          | spec §3.7, decisão 3                             |
| Depois do reinício do servidor, a batalha voltou? Quanto tempo levou para reconectar?       | `services/battle-restore.ts`                     |
| "Sair da batalha" e "Pedir para cancelar" foram entendidos? Alguém tentou fugir de derrota? | decisões 2 e 8                                   |
| O "Reiniciar" do mestre levou todos à formação nova sem confusão?                           | decisão 7                                        |
| A latência dos EUA atrapalhou a disputa do sinal?                                           | região do Render (só há EUA, Europa e Ásia)      |
| A hibernação de 15 min atrapalhou o início da sessão?                                       | aquecer o serviço antes; ou plano pago           |

Ajustes de regra voltam para a spec; números para `game-config`; o resto vira item da próxima
fase. Ao terminar, registrar as impressões no fim deste arquivo.

## Mídia (opcional)

Para testar upload de imagem e vídeo no ar, troque as variáveis `S3_*` por um storage
compatível com S3 que aceite upload direto do navegador (CORS liberado para o endereço do
serviço e leitura pública). O **Cloudflare R2** tem 10 GB gratuitos, mas pede cartão para
verificação. `S3_ENDPOINT` é `https://<account-id>.r2.cloudflarestorage.com`; `S3_PUBLIC_BASE_URL`
é o endereço público do bucket (`https://pub-….r2.dev`). Depois de trocar, faça um Manual Deploy.
