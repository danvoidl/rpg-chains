# Playtest da Fase 5 — fluxo de capítulo

Roteiro do playtest que fecha a Fase 5 (plano da Fase 5, M6). Objetivo: ver se **a trilha deixa
claro o que fazer**, se **a volta à fogueira dói na medida certa** e se **o grupo se divide nos
ramos**. Combate, habilidades, itens e economia já foram playtestados nas Fases 3 e 4. Aqui eles
só servem de meio.

## Preparação

1. Subir o banco e aplicar as migrations novas (`phase5_chapter_flow`, `phase5_chapter_opening`):
   `pnpm db:up`, depois `pnpm --filter @rpg-chains/server exec prisma migrate deploy`.
2. Conferir o `apps/server/.env`: a Fase 5 exige `MEDIA_MAX_VIDEO_BYTES` (veja o
   `.env.example`). Para jogar em várias máquinas, `WEB_ORIGIN`, `BETTER_AUTH_URL` e
   `NEXT_PUBLIC_API_URL` precisam apontar para um endereço que todos alcancem.
3. Subir as duas apps (`pnpm --filter @rpg-chains/server dev`, `pnpm --filter @rpg-chains/web dev`).
4. O mestre cria a conta pela web e gera a campanha:
   `pnpm --filter @rpg-chains/server seed:playtest <e-mail do mestre>`.
5. O mestre cria uma sala pública a partir dela. Cada jogador entra pelo celular ou pelo
   computador (de preferência os dois tipos na mesma partida) e escolhe uma classe.

### A campanha do seed

Só perguntas objetivas: o mestre não precisa julgar nada, e pode jogar com uma classe.

**Capítulo 1 — O Porão das Correntes** (com abertura)

| Linha | Nós                                              |
| ----- | ------------------------------------------------ |
| 0     | A descida (narrativa, entrada, obrigatória)      |
| 1     | Ratos no porão (nível 1)                         |
| 2     | O bandido (nível 1)                              |
| 3     | O mercador (loja) · As brasas (fogueira) — ramos |
| 4     | A matilha (nível 1)                              |
| 5     | O Carcereiro (chefe)                             |

**Capítulo 2 — A Torre das Correntes** (com abertura)

| Linha | Nós                                                                   |
| ----- | --------------------------------------------------------------------- |
| 0     | A escada (narrativa, entrada, obrigatória)                            |
| 1     | O corredor oeste (nível 2) · O corredor leste (nível 2), obrigatórios |
| 2     | O patamar (nível 3)                                                   |
| 3     | O contrabandista (loja) · A lareira (fogueira) — ramos                |
| 4     | O Guardião da Torre (chefe, nível 3)                                  |

As regras que a mesa vai sentir (spec §2.3, §3.7):

- **Desbloqueio:** um nó se abre quando algum nó ligado a ele é concluído. O chefe ainda espera
  todos os nós obrigatórios do capítulo.
- **Batalhas:** uma batalha vencida não se repete.
- **Lojas e fogueiras:** continuam abertas depois de usadas.
- **Fogueira:**
  - Acender restaura vida e energia de todos que não estão em batalha.
  - Ela vira o ponto de volta do capítulo.
  - Pode ser reacesa à vontade.
- **Derrota:**
  - Quem perdeu volta restaurado, mas perde 20% do ouro (`DEFEAT_GOLD_LOSS_FRACTION`).
  - Voltam a ficar abertos só os nós do capítulo que **os derrotados** concluíram **depois da
    última fogueira acesa**. Sem fogueira acesa no capítulo, o ponto de volta é a entrada.

## Roteiro

Cada passo exercita uma parte da fase. Não precisa seguir à risca, mas tente passar por todos.

1. **Entrada:** cada um vê a abertura do capítulo 1 ao entrar, uma vez só. Recarregar a página
   não deve mostrar de novo. "Ver abertura", no cabeçalho do capítulo, mostra de novo.
2. **Narrativa:** um jogador toca em "A descida" → "Ler" → "Continuar". Os outros devem ver
   "Ratos no porão" se abrir sozinho, sem recarregar.
3. **Batalhas:** formar e vencer as batalhas pelo balão do nó ("Formar batalha"). Quem não
   formou entra pelo cartão da formação. Depois de vencida, a batalha fica fechada na trilha.
4. **Ramos:** depois de "O bandido", a loja e a fogueira se abrem juntas. Deixar o grupo decidir
   sem orientação: alguém vai à loja? alguém acende a fogueira antes da matilha?
5. **Derrota de propósito:** depois de acender "As brasas", um jogador forma "A matilha" sozinho
   e sai da página da batalha (ou perde). Conferir:
   - ele volta com vida e energia cheias e com menos ouro;
   - a tela de fim diz para qual fogueira voltou;
   - nada do que veio antes da fogueira reabriu.

   Repetir uma vez **sem** fogueira acesa, no capítulo 2, para sentir a volta à entrada.

6. **Chefe:** o Carcereiro só se abre depois de todos os obrigatórios. Vencê-lo mostra
   "Capítulo concluído!" e abre o capítulo 2, com a abertura dele.
7. **Capítulo 2, dividido:** o grupo se divide entre os dois corredores, que são obrigatórios e
   podem ser lutados ao mesmo tempo, e depois se junta no patamar.
8. **Fim:** vencer o Guardião da Torre mostra "Campanha concluída!" e a faixa na sala. A sala
   continua jogável: alguém compra algo ou faz uma troca antes de o mestre encerrar.
9. **Histórico:** o mestre toca em "Encerrar a sala". Cada jogador abre "Histórico" no menu e
   confere classe, nível, ouro e "Campanha concluída".

### Autoria (opcional, 15 minutos, quem for autor)

- Criar um capítulo no editor e conferir que os nós encaixam na grade de 5 colunas e que não dá
  para soltar um nó em cima de outro.
- Abrir um capítulo antigo, desenhado antes da trilha: "Encaixar na grade" deve organizá-lo.
- Subir um **vídeo de verdade** (mp4 ou webm, até 50 MB) na abertura de um capítulo e numa
  narrativa, publicar e ver o vídeo tocar na sala. É o único caminho da fase que ainda não foi
  testado no navegador.
- Publicar um capítulo com batalhas e sem fogueira: o aviso deve aparecer, sem bloquear.

## Limites conhecidos (não anotar como bug)

- **Linhas entre os nós:** não são desenhadas na trilha. O balão também não diz o que falta para
  liberar um nó bloqueado (decisão 13).
- **Mestre sem classe:** a abertura só aparece sozinha para quem tem personagem. O mestre sem
  classe usa "Ver abertura".
- **Dois botões de encerrar:** na sala concluída, o mestre vê "Encerrar a sala" (na faixa) e
  "Encerrar sala" (no painel). Os dois fazem a mesma coisa.
- **Batalha cai com a conexão:** recarregar ou sair da página da batalha ainda tira o jogador da
  luta, e uma queda do servidor perde a batalha em andamento (Fase 6).
- **Tempos do turno:** ainda são os da plataforma, com o ajuste do mestre. Os tempos definidos
  pela campanha ficaram para depois (decisão 16).

## O que observar e anotar

| Pergunta                                                                                 | Onde ajustar                                       |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------- |
| A trilha deixa claro o que fazer? Alguém ficou parado sem saber qual nó tocar?           | trilha / balão (UI)                                |
| Os estados (bloqueado, liberado, concluído, em andamento, fogueira acesa) se distinguem? | `features/trail/trail-node.tsx`                    |
| A falta das linhas atrapalhou? Alguém pediu para ver "o que libera o quê"?               | decisão 13 (linhas / balão com o que falta)        |
| No celular, os nós são fáceis de tocar? O balão cobre o que não devia?                   | `TRAIL_*` (`shared-types/trail.ts`), balão         |
| A abertura aparece na hora certa? Incomoda ver de novo em outro aparelho?                | `features/trail/opening-seen.ts`                   |
| A volta à fogueira dói na medida certa ou frustra? E a volta à entrada?                  | spec §3.7, `DEFEAT_GOLD_LOSS_FRACTION`             |
| Desfazer só o que os derrotados fizeram pareceu justo para quem não lutou?               | decisão 5 (opção b)                                |
| Quem lutou nos dois ramos e perdeu num deles achou justo perder o outro também?          | riscos do plano                                    |
| O grupo se dividiu nos ramos ou andou junto o tempo todo?                                | desenho dos capítulos / obrigatórios               |
| A fogueira foi acesa por estratégia ou por acaso? Alguém reacendeu?                      | decisão 4                                          |
| A sala concluída continuar jogável fez sentido, ou o grupo esperava um fim?              | spec §7, faixa da sala concluída                   |
| O histórico mostra o que o jogador queria lembrar?                                       | `features/history/`                                |
| Alguém travou, perdeu progresso sem entender, ou viu um nó em estado errado?             | registrar o caso (sala, nó, quem, o que fez antes) |

Ajustes de regra voltam para a spec; números para `game-config`; o resto vira item da Fase 6 ou
de uma fase própria. Ao terminar, registrar as impressões no fim deste arquivo, como na Fase 4.
