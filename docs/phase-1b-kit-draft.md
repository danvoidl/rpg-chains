# Fase 1b — Rascunho de faixas e do kit padrão

_Proposta para aprovação (M0 do [plano da 1b](phase-1b-plan.md)). Fecha a pendência da
[spec §9](spec.md). Aprovado em 2026-10-06 e implementado: faixas e tetos em
`game-config/src/skills.ts`, kit em `game-config/src/classes.ts`. Todos os números são de partida e mudam no playtest._

## Premissas que os números assumem

- **O grupo tem uma ação por rodada**, não uma por jogador (spec §3.1). "Rodada" = um turno do
  grupo; durações e cooldowns contam nessa unidade. Um buff de 3 rodadas cobre as próximas 3 ações
  do grupo inteiro, então buffs em área valem muito mais do que parecem.
- **Nível 1 tem 0 pontos de atributo.** Tudo que escala com atributo vale só a parte fixa no
  início; os 3 pontos por nível (57 no nível 20) fazem a curva.
- **Referência de dano no nível 1:** ataque básico de 7 a 12 de dano bruto; vida dos personagens
  de 80 a 120. Uma habilidade de dano de nível 1 deve valer de 1,3× a 1,8× o ataque básico, já que
  custa energia e cooldown.

## Duas lacunas da spec que o kit expõe (decidir antes)

1. **O modo `scaling` não tem parte fixa.** Hoje é `{ attribute, scale }`, ou seja,
   `magnitude = atributo × escala`. No nível 1 (atributo 0) toda habilidade que escala causa **0**.
   **Proposta:** adicionar `base` ao modo `scaling` → `base + atributo × escala`, com
   `.default(0)` para não quebrar snapshots existentes. É uma mudança só de schema em
   `effects.ts`, sem migration, e espelha a própria fórmula de arma
   (`DanoBase + Atributo × Escala`).
2. **O que `percent` significa em cada tipo.** A spec define percentual para atributo (§5.5) e
   deixa os outros em aberto. Proposta, para o motor da Fase 3 seguir:

   | Tipo                        | `percent` é…                                              |
   | --------------------------- | --------------------------------------------------------- |
   | dano                        | % do dano bruto do ataque básico de quem lança            |
   | dano contínuo               | % da vida máxima do alvo, por rodada                      |
   | cura, cura contínua, escudo | % da vida máxima do alvo                                  |
   | restaurar energia           | % da energia máxima do alvo                               |
   | redução de vida máxima      | % da vida máxima do alvo                                  |
   | buff / debuff               | canal percentual do atributo (§5.5), como já está na spec |

Também em aberto e **não** decidido aqui: se a inteligência ("+2 de poder de habilidade",
§4.1) soma em toda habilidade ou só via `scaling` com `intelligence`. Proponho só via `scaling`,
sem conceito separado de "poder de habilidade" no motor: menos regra escondida, e o autor vê no
editor exatamente quanto a habilidade escala. Os números do kit abaixo assumem isso. Decisão da
Fase 3, mas afeta o kit.

## Tetos (erro, bloqueiam o publish)

| Regra                                  | Valor proposto | Por quê                                                                                  |
| -------------------------------------- | -------------- | ---------------------------------------------------------------------------------------- |
| Duração máxima de atordoar             | 1 rodada       | Com uma ação por rodada, dois atordoadores alternando trancam um chefe solo (spec §5.6). |
| Duração máxima de redução de vida máx. | 3 rodadas      | Encadeada, transforma qualquer cura em inútil.                                           |
| % de vida no reerguer                  | ≤ 100          | Acima disso não tem significado.                                                         |
| Custo 0 **e** cooldown 0 juntos        | proibido       | Spec §5.6: habilidade gratuita e sem espera vira a única ação do jogo.                   |

Sobre o atordoar: o pior caso de cobertura é `vagas da classe × duração ÷ cooldown`. Com o kit
(Arauto: 2 vagas, cooldown 5, duração 1) um chefe fica atordoado no máximo 40% das rodadas, e só
a partir do nível 13. Se no playtest ainda for demais, o ajuste é cooldown, não duração.

## Faixas recomendadas (aviso, pedem confirmação)

Valores no nível de desbloqueio. "Área" = alvo `all_allies` ou `all_enemies`; o efeito em área
tem faixa mais baixa porque atinge vários.

| Tipo                   | Modo            | Alvo único               | Área                      |
| ---------------------- | --------------- | ------------------------ | ------------------------- |
| dano                   | fixo            | 10–40                    | 6–25                      |
| dano                   | percentual      | 120–250%                 | 60–120%                   |
| dano                   | escala          | base 5–30, escala 0,5–3  | base 4–20, escala 0,5–1,5 |
| dano contínuo          | fixo / %        | 3–12 / 2–6% por rodada   | 2–8 / 1–4%                |
| cura                   | fixo / %        | 15–50 / 10–40%           | 8–30 / 5–30%              |
| cura                   | escala          | base 10–35, escala 0,5–3 | base 6–20, escala 0,5–1,5 |
| cura contínua          | fixo / %        | 4–15 / 3–10% por rodada  | 3–10 / 2–8%               |
| reerguer               | % de vida       | 20–50%                   | 15–30%                    |
| restaurar energia      | fixo / %        | 10–30 / 15–40%           | 5–20 / 10–25%             |
| escudo                 | fixo / %        | 15–60 / 10–35%           | 10–40 / 5–20%             |
| buff / debuff          | percentual      | 5–30%                    | 5–20%                     |
| buff / debuff          | fixo — atributo | 2–10                     | 2–6                       |
| buff / debuff          | fixo — dano     | 3–15                     | 2–10                      |
| buff / debuff          | fixo — defesa   | 5–30                     | 5–20                      |
| redução de vida máxima | %               | 5–25%                    | 5–15%                     |
| dissipar               | quantidade      | 1–3                      | 1–2                       |

Durações (aviso fora disso): efeitos com duração 1–4 rodadas; provocar 1–2.
Custo 15–40 e cooldown 2–5 já estão em `game-config` (§4.3) e continuam.
Soma mínima recomendada de vagas da campanha: **8** (aviso abaixo disso; §5.2).

## Kit padrão

Unlock nos níveis padrão 1, 4, 8, 13. Armas base sem requisito de atributo (personagem nível 1
tem 0 pontos). Nome em português = texto exibido; o identificador em código fica em inglês, como
o `DEFAULT_CLASS_KIT` atual.

Vagas: **Guardião 2, Penitente 4, Arauto 2, Sacerdote 2 = 10**. Penitente tem mais vagas porque é
o papel que menos quebra a composição se repetido; suporte e controle são os papéis que viram
abuso quando empilhados.

### Guardião — tanque (120 vida / 40 energia, +12 / +3)

**Arma:** Maça de Ferro — pesada, dano base 10, escala com força ×1,5.

| Nível | Habilidade        | Efeito                                           | Custo | Cooldown |
| ----- | ----------------- | ------------------------------------------------ | ----- | -------- |
| 1     | Corrente de Ferro | provocar, duração 1                              | 15    | 3        |
| 4     | Muralha           | escudo em si, 25% da vida máx., 2 rodadas        | 20    | 4        |
| 8     | Brado Intimidador | debuff de dano −20% em todos os inimigos, 2 r    | 25    | 4        |
| 13    | Bastião           | buff de defesa +20 fixo em todos os aliados, 3 r | 35    | 5        |

Sem habilidade de dano de propósito: o valor do Guardião é trocar a ação do grupo por anular um
ataque em área (§3.6). Nível 1: escudo de 30, provocar já disponível.

### Penitente — dano físico (90 / 50, +7 / +5)

**Arma:** Lâmina Penitente — leve, dano base 12, escala com destreza ×2.

| Nível | Habilidade       | Efeito                                         | Custo | Cooldown |
| ----- | ---------------- | ---------------------------------------------- | ----- | -------- |
| 1     | Golpe Expiatório | dano em um inimigo, 160% do ataque básico      | 15    | 2        |
| 4     | Sangria          | dano contínuo, 8 por rodada, 3 rodadas         | 20    | 3        |
| 8     | Fervor           | buff de dano +30% em si, 3 rodadas             | 25    | 4        |
| 13    | Juízo Final      | dano em um inimigo, escala: 25 + destreza ×2,5 | 40    | 5        |

Nível 1: básico 12, Golpe ~19. Nível 13 com ~20 de destreza: básico 52, Juízo Final 75 (e 97
com Fervor ativo).

### Arauto — dano mágico e controle (85 / 65, +6 / +7)

**Arma:** Cetro do Arauto — leve, dano base 8, escala com inteligência ×1,5.

| Nível | Habilidade       | Efeito                                           | Custo | Cooldown |
| ----- | ---------------- | ------------------------------------------------ | ----- | -------- |
| 1     | Chama Anunciada  | dano em um inimigo, escala: 14 + inteligência ×2 | 15    | 2        |
| 4     | Trovão do Arauto | dano em todos os inimigos, escala: 8 + int. ×1   | 25    | 3        |
| 8     | Proclamação      | buff de dano +15% em todos os aliados, 3 rodadas | 30    | 4        |
| 13    | Silêncio Imposto | atordoar um inimigo, 1 rodada                    | 35    | 5        |

O atordoar fica no 13 para não existir controle nos capítulos iniciais, onde a vida dos vilões é
baixa e tirar um turno decide a luta.

### Sacerdote — cura e reerguer (80 / 70, +5 / +8)

**Arma:** Cajado Consagrado — leve, dano base 7, escala com inteligência ×1.

| Nível | Habilidade      | Efeito                                                | Custo | Cooldown |
| ----- | --------------- | ----------------------------------------------------- | ----- | -------- |
| 1     | Prece           | cura em um aliado, escala: 20 + inteligência ×2       | 15    | 2        |
| 4     | Reerguer        | reerguer um aliado com 40% da vida                    | 35    | 5        |
| 8     | Bênção Contínua | cura contínua em todos os aliados, 6% por rodada, 3 r | 25    | 4        |
| 13    | Graça Plena     | cura em todos os aliados, 30% da vida máx.            | 40    | 5        |

Reerguer no 4, não no 8: antes dele, quem cai só volta na fogueira, e quatro níveis sem revive já
são o bastante para os capítulos iniciais terem peso.

### Cobertura do catálogo

O kit usa 10 dos 13 tipos. Ficam de fora **restaurar energia, dissipar e redução de vida
máxima** — continuam disponíveis para o autor. O e2e e os testes do editor devem cobrir os 13 por
fixture própria, não pelo kit.

## O que preciso de você

1. Aprovar ou ajustar as duas lacunas (`base` no `scaling` e a tabela de `percent`).
2. Tetos e faixas: aprovar ou mudar números.
3. Kit: papéis, vagas e as 16 habilidades.
