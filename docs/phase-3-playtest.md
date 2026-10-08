# Playtest da Fase 3 — fatia objetiva

Roteiro do playtest que fecha a Etapa A (plano da Fase 3, M5). Objetivo: medir **ritmo**, não
dificuldade — o combate ainda não tem habilidades nem itens (M6) nem perguntas abertas (M7).

## Preparação

1. Subir o banco e as duas apps (`pnpm db:up`, `pnpm --filter @rpg-chains/server dev`,
   `pnpm --filter @rpg-chains/web dev`). Para jogar em várias máquinas, `WEB_ORIGIN`,
   `BETTER_AUTH_URL` e `NEXT_PUBLIC_API_URL` precisam apontar para um endereço que todos alcancem.
2. O mestre cria a conta pela web e gera a campanha:
   `pnpm --filter @rpg-chains/server seed:playtest <e-mail do mestre>`.
   Ela traz o kit padrão e um capítulo: narrativa → Ratos no porão → O bandido → A matilha → O
   Carcereiro (chefe), com 15 perguntas objetivas.
3. O mestre cria uma sala pública a partir dela; cada jogador escolhe uma classe.

## Partida

- Jogar as três batalhas e o chefe em sequência, 2 a 4 jogadores. O mestre usa "Descansar o
  grupo" quando achar justo (é o substituto provisório da fogueira).
- Ninguém sai da página da batalha no meio: hoje isso tira o jogador da luta (spec §7).

## Referência da simulação

O robô do motor (acerta 80%, sem atrasos) vence tudo sem descanso; rodadas por batalha:

| Grupo | Ratos | Bandido | Matilha | Chefe | Vida restante no chefe |
| ----- | ----- | ------- | ------- | ----- | ---------------------- |
| 2     | 6     | 5       | 6       | 9,5   | 27 de 210              |
| 3     | 6     | 6       | 8       | 11    | 50 de 290              |
| 4     | 6     | 7       | 8       | 12    | 92 de 375              |

O grupo age uma vez por rodada qualquer que seja o tamanho: grupo maior só divide melhor o dano.

## O que observar e anotar

| Pergunta                                                                  | Onde ajustar                    |
| ------------------------------------------------------------------------- | ------------------------------- |
| Quanto dura uma rodada (pergunta → sinal → resposta → ação)?              | —                               |
| 20 s para tocar o sinal, 30 s para responder e para agir: sobra ou falta? | `BATTLE_TIMERS` (`game-config`) |
| Falta uma contagem regressiva na tela?                                    | contrato (prazo nos estágios)   |
| O turno inimigo dá para acompanhar? As pausas (~650 ms) estão boas?       | `apps/web/.../event-pacing.ts`  |
| A rotação do sinal é entendida ("descansando")?                           | UI                              |
| Alguém travou, perdeu a vez sem entender, ou caiu da batalha sem querer?  | registrar o caso                |
| Batalhas fáceis/difíceis demais? Quantos caíram?                          | vilões da campanha de playtest  |
