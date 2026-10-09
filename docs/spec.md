# As Sete Correntes — Especificação de Site e Jogo

_Documento consolidado de requisitos, regras de sistema e plano de desenvolvimento._

---

## 1. Conceito e escopo

A plataforma é um sistema de campanhas de RPG por turnos jogadas ao vivo, em que um mestre de história conduz um grupo de jogadores por capítulos compostos de batalhas, lojas, fogueiras e trechos narrativos. O combate é mediado por perguntas: o grupo só age quando um de seus integrantes responde corretamente a um desafio apresentado na tela. Qualquer usuário cadastrado pode tanto criar campanhas quanto jogá-las, e uma mesma campanha pode estar sendo jogada por várias salas ao mesmo tempo, cada uma com progresso independente.

O sistema se organiza em três camadas conceituais que precisam permanecer distintas em todo o código e no banco de dados. A **Campanha** é o conteúdo autoral e reutilizável, criado e editado por um usuário. A **Sala** é uma instância viva daquela campanha, criada por outro usuário qualquer, com progresso próprio e duração longa — ela permanece ativa até que a campanha seja concluída ou que seu dono a encerre. O **Perfil de Campanha** é o personagem de um jogador dentro de uma sala específica, com nível, atributos, equipamentos e inventário que existem apenas naquele contexto e não são transferidos para outras salas.

---

## 2. Modelo de domínio

### 2.1 Entidades principais

| Entidade               | Descrição                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Usuário**            | Conta global. Autentica, cria campanhas, cria e entra em salas.                                                                                         |
| **Campanha**           | Conteúdo autoral. Possui rascunho editável e versões publicadas.                                                                                        |
| **Capítulo**           | Unidade da campanha. Contém um grafo de nós. Pode estar "em construção".                                                                                |
| **Nó**                 | Ponto no grafo do capítulo. Tipos: batalha, loja, fogueira, narrativa.                                                                                  |
| **Vilão**              | Inimigo configurável com HP, atributos, imagem e lista de ataques.                                                                                      |
| **Classe**             | Arquétipo autoral da campanha. Define vida e energia base, ganho por nível, limite de vagas e o conjunto de habilidades. Pertence a uma única campanha. |
| **Habilidade**         | Ação criada pelo autor a partir de um tipo de efeito genérico, com alvo, magnitude, duração, custo e cooldown.                                          |
| **Pergunta**           | Desafio de combate. Tipo objetivo (validação automática) ou aberto (julgado pelo mestre).                                                               |
| **Sala**               | Instância de jogo. Pública ou privada com código. Tem dono/mestre transferível.                                                                         |
| **Perfil de Campanha** | Personagem do jogador na sala. Nível, atributos, HP, energia, ouro, equipamentos, inventário.                                                           |
| **Batalha Ativa**      | Estado transitório de uma luta em andamento. Fonte da verdade no servidor.                                                                              |
| **Histórico**          | Registro permanente de campanhas encerradas e do personagem do usuário nelas.                                                                           |

### 2.2 Versionamento de campanha

O criador da campanha e o dono da sala são pessoas diferentes, e o criador não tem visibilidade nem controle sobre salas de terceiros que estejam jogando seu conteúdo. Por isso a edição é resolvida por **publicação por versão**: a campanha mantém um rascunho sempre editável e um histórico de versões publicadas, cada uma imutável. O criador edita o rascunho livremente e publica quando quiser — para lançar capítulos novos, corrigir uma pergunta com bug ou rebalancear números.

Ao contrário de um modelo de sala congelada, as salas em andamento **acompanham** a última versão publicada: cada sala guarda um ponteiro para a versão que está jogando e o avança automaticamente para a mais recente **em ponto seguro** — entre batalhas ou numa fogueira, nunca no meio de uma batalha (uma batalha em andamento termina na versão em que começou, o que preserva o determinismo do replay descrito na seção 3). Não há ação do mestre: o autor "empurra" publicando, e as salas rolam para frente sozinhas, recebendo conteúdo novo e correções sem perder progresso.

Como o autor não enxerga as salas de terceiros, quem garante que esse avanço é seguro não é o julgamento dele, e sim um **portão de compatibilidade** na publicação. A partir da segunda publicação, cada versão é validada contra a anterior e só é aceita se for **retrocompatível** — mudanças aditivas e correções não-quebrantes passam; mudanças que invalidariam um personagem em jogo são recusadas, e a publicação falha listando as violações. A regra vale sempre após o primeiro publish, exista ou não uma sala viva, para dar previsibilidade ao autor; o primeiro publish avisa esse contrato. Capítulos marcados como "em construção" permanecem no rascunho e não entram na versão publicada com conteúdo, o que dispensa qualquer mecanismo separado para eles — e são o palco natural para preparar um capítulo antes de liberá-lo. Da versão publicada eles levam só o nome, para que os jogadores vejam no fim da trilha que há capítulos a caminho. Como capítulos novos só entram depois dos já publicados, um capítulo em construção precisa ficar depois de todos os publicados na ordem da campanha.

#### 2.2.1 O que a publicação permite e proíbe após o primeiro publish

O critério é o que um personagem em jogo (Perfil de Campanha) e o log de batalha referenciam: o id da classe, o conjunto de habilidades da classe, os ids de itens equipados e no inventário, e os ids de nós, perguntas e vilões.

**Permitido** (a versão nova rola para a sala com segurança):

- Adicionar conteúdo: capítulos (sempre depois dos já publicados), nós, arestas, classes, vilões, ataques, perguntas, itens e habilidades a uma classe.
- Editar texto e arte: enunciados, nomes, descrições, ícones, imagens e vídeos.
- Corrigir uma pergunta: alternativas e resposta correta.
- Balancear números de vilão, habilidade e item: vida, atributos, dano base, custo de energia, cooldown, nível de desbloqueio e a magnitude/duração do efeito de uma habilidade. É seguro porque o perfil não guarda os números da habilidade — o motor os lê da versão vigente no momento do uso, e o avanço nunca acontece no meio de uma batalha.
- Aumentar o limite de vagas de uma classe.

**Proibido** (o portão recusa):

- Deletar qualquer entidade referenciável por id: classe, habilidade, pergunta, item, vilão ou nó.
- Alterar os atributos-base de uma classe (vida e energia base, ganho por nível, arma base), pois eles definem os valores derivados de personagens que já existem.
- Reduzir o limite de vagas de uma classe.
- Remover uma habilidade de uma classe — o conjunto é só-adição; rebalancear uma habilidade existente é permitido.
- Reordenar os capítulos publicados ou inserir um capítulo antes deles — a sala avança de capítulo em capítulo, na ordem.
- Quebrar a estrutura do grafo: remover um nó ou aresta de modo a tornar inalcançável um nó antes alcançável, ou remover o nó de entrada ou o de chefe.

Curva de XP, constante de dano e fator de relevância vivem na configuração da plataforma (seção 4), não no conteúdo autoral, e portanto não fazem parte deste versionamento; alterá-los é um evento de plataforma, não de publicação de campanha.

### 2.3 Grafo do capítulo

Cada capítulo é um grafo direcionado em forma de árvore invertida: múltiplos caminhos partindo de uma entrada e convergindo para o nó de chefe. Cada nó carrega o tipo, os pré-requisitos de desbloqueio, a marcação de obrigatório ou opcional, o limite de jogadores e um **nível recomendado** — este último é o parâmetro central do balanceamento descrito na seção 4.5.

Os nós de batalha respeitam um limite de participantes definido pelo criador. Salas de chefe não têm limite. Os jogadores escolhem livremente de qual nó participar, respeitando a lotação, e uma vez dentro de uma batalha não podem trocar até que ela termine.

**Progresso e desbloqueio.** O progresso no grafo é da sala, não de cada jogador: quem chega depois encontra o mapa como o grupo o deixou. Cada nó está bloqueado, liberado ou concluído. Uma batalha (ou o chefe) é concluída com a vitória; uma narrativa, quando alguém a lê e segue em frente; uma loja, na primeira vez que alguém a abre; uma fogueira, quando alguém a acende. As arestas são o caminho e os pré-requisitos são a trava: um nó é liberado quando alguma aresta que chega nele vem de um nó concluído (a entrada do capítulo já começa liberada) **e** todos os seus pré-requisitos estão concluídos. O chefe, além disso, só é liberado quando todos os nós obrigatórios do capítulo — de qualquer tipo, não só batalhas — estiverem concluídos; isso acontece automaticamente, sem liberação manual pelo mestre nem decisão do grupo. Uma batalha vencida não pode ser lutada de novo; só a volta à fogueira depois de uma derrota a reabre (seção 3.7).

**Capítulos.** O capítulo é concluído quando o chefe é vencido, e isso libera a entrada do capítulo seguinte, na ordem da campanha. Capítulos já concluídos continuam abertos: suas lojas e fogueiras podem ser usadas e suas batalhas opcionais não feitas podem ser jogadas. A conclusão é permanente — uma versão nova que acrescente nós a um capítulo concluído não o reabre.

**Fogueira.** Qualquer jogador da sala, fora de batalha, pode acender uma fogueira liberada, quantas vezes quiser. Ela reergue os caídos e restaura HP e energia de todos os jogadores da sala que não estão em batalha, e passa a ser o ponto de volta do capítulo em caso de derrota (seção 3.7).

**Trilha.** O jogador vê a campanha como uma trilha, no estilo do Duolingo: uma coluna estreita e de largura fixa que só cresce para baixo, igual no celular e no computador — no computador ela fica centralizada, com o resto da sala nas laterais. Todos os capítulos ficam numa só rolagem, um abaixo do outro, cada um com seu cabeçalho (nome e abertura): os concluídos acima, o atual em vista, os bloqueados em cinza e, no fim, os capítulos em construção. Os nós aparecem com o estado de cada um, e tocar num nó abre a ação dele; as arestas valem para o desbloqueio mas não são desenhadas. Para a trilha funcionar em qualquer tela, todo capítulo tem a mesma largura e o editor encaixa cada nó numa grade de cinco colunas, com quantas linhas o autor quiser — vários nós na mesma linha formam ramos e trechos horizontais. O autor vê no editor exatamente o que o jogador verá.

**Abertura.** Cada capítulo pode ter uma abertura — um texto e um vídeo — que cada jogador vê ao chegar nele pela primeira vez e pode rever quando quiser. A abertura da campanha é a do primeiro capítulo. Os nós de narrativa também podem ter vídeo.

**Mapa de fundo (contrato preparado, editor em fase futura).** Um capítulo pode ter uma imagem de fundo — tipicamente um mapa — e cada nó é posicionado num ponto dessa imagem. As posições dos nós são coordenadas absolutas em pixels de um "mundo" com a largura fixa da trilha e altura definida junto com a imagem; a imagem é sempre escalada para esse tamanho, então trocar o mapa por outra resolução não desloca os nós. Trocar ou remover o mapa e renomear nós são edições de arte/texto, permitidas pelo portão de compatibilidade.
---

## 3. Sistema de combate

### 3.1 Ordem de ação

A iniciativa é sorteada no início da batalha, definindo se o grupo ou os inimigos agem primeiro. A partir daí o ciclo alterna estritamente: um inimigo age, o grupo age, o próximo inimigo age, o grupo age novamente. Os inimigos formam uma fila circular — quem acabou de agir vai para o fim dela — de modo que com múltiplos vilões cada um age em intervalos regulares em vez de todos agirem de uma vez.

Quando chega a vez do grupo, um sinal é exibido a todos os participantes da batalha junto com uma pergunta. O primeiro jogador a tocar no sinal ganha o direito de responder. Se acertar, executa uma ação; se errar, a vez passa imediatamente para o próximo inimigo da fila e nenhum outro jogador tem chance de tentar.

### 3.2 Perguntas e julgamento

Existem dois tipos de pergunta. As **objetivas** são de múltipla escolha e validadas automaticamente pelo sistema, dispensando a presença do mestre. As **abertas** exigem que o mestre avalie a resposta e aprove ou reprove manualmente; ele pode cadastrá-las antes da batalha e acrescentar novas durante o combate, e os jogadores veem apenas o que ele exibir.

Como há um só mestre e o grupo pode se dividir em ramos simultâneos, perguntas abertas ficam restritas a batalhas de caminho único e a chefes. Ramos paralelos usam obrigatoriamente perguntas objetivas, de modo que várias batalhas possam correr ao mesmo tempo sem depender da atenção do mestre. O editor de campanha valida essa regra e avisa o criador quando ele configurar uma pergunta aberta num nó que pertence a um ramo paralelo.

**O mestre conduz as perguntas.** Numa batalha com pergunta aberta e o mestre presente, no início de cada turno do grupo ele escolhe o que exibir: uma pergunta aberta do nó, uma pergunta escrita na hora, ou uma objetiva do nó sorteada pelo sistema (se o nó tiver). O turno espera a escolha dele, sem prazo. Perguntas escritas na hora valem só para aquela batalha: não entram no banco da campanha.

Como só o mestre julga perguntas abertas, **uma batalha que tem pergunta aberta só pode começar com o mestre ativo (conectado) na sala**. Batalhas só com perguntas objetivas não dependem dele e podem ser jogadas na sua ausência.

**O mestre como jogador.** O mestre pode ter um Perfil de Campanha, mas **não entra como combatente numa batalha que tenha pergunta aberta** — ali ele é o juiz, e não pode julgar a própria resposta. Em batalhas só com perguntas objetivas ele luta como qualquer jogador. Enquanto houver uma batalha com pergunta aberta em andamento, o papel de mestre não pode ser transferido.

**Queda do mestre no meio de uma batalha com pergunta aberta.** O mestre tem o mesmo período de graça dos jogadores (seção 7): recarregar a página ou perder a rede por alguns instantes não muda nada na batalha. Passado o prazo, a batalha não é perdida: enquanto o mestre estiver ausente, o turno do grupo passa a usar as perguntas objetivas daquele nó, se houver. Se o nó só tiver perguntas abertas, a batalha **pausa** no início do turno do grupo — inimigos também não agem — até o mestre voltar ou a batalha ser cancelada. Uma resposta aberta já enviada continua aguardando o julgamento.

### 3.3 Rotação da campainha

Um jogador que agiu numa rodada fica bloqueado do sinal na rodada seguinte. Isso garante rotação sem impedir que o grupo escolha quem age em momentos críticos. Jogadores mortos ou desconectados saem da lista de elegíveis; se em algum momento não restar nenhum jogador elegível, o bloqueio é ignorado e todos os vivos e conectados voltam a poder responder. Um jogador desconectado, ainda dentro do período de graça (seção 7), continua na batalha e continua sendo alvo dos inimigos — cair não é uma esquiva —, só não pode tocar no sinal até voltar.

Habilidades que não causam dano — provocar, curar, reerguer, aplicar buff — contam como a ação da rodada da mesma forma que um ataque, e portanto também bloqueiam quem as usou na rodada seguinte. Errar a resposta não é agir: quem erra não fica bloqueado.

**Tempo limite.** Cada etapa do turno do grupo tem um prazo, com um padrão da plataforma que o mestre da sala pode ajustar dentro de limites (o ajuste vale a partir da batalha seguinte): se ninguém tocar no sinal, se quem tocou não responder ou se quem acertou não escolher a ação a tempo, o turno do grupo é perdido e a vez passa ao próximo inimigo. A resposta de uma pergunta aberta tem um prazo próprio, mais longo, porque precisa ser digitada. O julgamento do mestre e a escolha da pergunta não têm prazo. Isso impede que um jogador ausente congele a batalha.

### 3.4 Ações disponíveis

Ao acertar a pergunta, o jogador escolhe uma entre: **atacar** com a arma equipada, **usar uma habilidade** (paga energia e respeita o cooldown), ou **usar um consumível** do próprio inventário. Todas consomem a ação do grupo naquela rodada.

Buffs e curas consomem a ação normalmente. Isso é intencional: um buff de dano expressivo aplicado no personagem certo, seguido de um ataque crítico, compensa a rodada gasta.

### 3.5 Ataques inimigos

Cada vilão tem uma lista de ataques configurável pelo criador da campanha, contendo dano base, tipo de alvo (único ou área) e frequência ou cooldown. Ataques de alvo único selecionam aleatoriamente entre os jogadores vivos da batalha; ataques em área atingem todos. A cada turno, o vilão sorteia um ataque entre os que estão fora de cooldown (se todos estiverem, usa o de menor cooldown restante); o cooldown de um ataque de vilão é contado nos turnos daquele vilão.

### 3.6 Provocação

Provocar é um dos efeitos genéricos disponíveis para o autor da campanha montar habilidades defensivas. Quem usa gasta a ação do grupo e força o próximo ataque inimigo a ser redirecionado para si; se esse ataque for em área, ele se converte em ataque único contra o provocador. Trocar a ação da rodada por anular um ataque em área é o que dá função a qualquer classe construída em torno de aguentar dano.

_Parâmetro de ajuste: se em testes a provocação se mostrar fraca diante de filas longas de inimigos, a duração padrão pode passar de "um ataque" para "duas rodadas"._

### 3.7 Morte, revive e derrota total

Um jogador com HP zerado fica caído: não age, não responde ao sinal e não pode ser alvo. O estado de caído é gravado no Perfil de Campanha, não na sessão — sair e reconectar não ressuscita ninguém.

Habilidades com efeito de reerguer devolvem aliados caídos ao combate, gastando a ação do grupo — cabe ao autor da campanha decidir quais classes têm acesso a elas, e se alguma tem. Fora de combate, nós de fogueira reerguem todos os caídos e restauram HP e energia. Ao cair, o personagem perde todos os efeitos ativos (cooldowns são mantidos); ao ser reerguido, volta com a porcentagem de vida definida pela habilidade. Cura comum não afeta caídos.

HP, energia e o estado de caído **persistem entre batalhas**: ao fim de cada batalha, vitória ou derrota, os valores de cada participante — inclusive de quem saiu por desconexão, no momento da saída — são gravados no Perfil de Campanha. Quem está caído não pode entrar numa batalha.

Se todos os jogadores de uma batalha caírem, a batalha é perdida e o grupo é devolvido automaticamente à última fogueira ativada, sem necessidade de percorrer o caminho. Os participantes da batalha perdida são restaurados como numa fogueira — HP e energia cheios, caídos reerguidos — e o progresso do capítulo volta àquela fogueira **apenas no que eles fizeram**: voltam a ficar em aberto os nós do capítulo concluídos depois que a fogueira foi acesa e de que algum deles tomou parte. O que outro subgrupo concluiu sem eles continua concluído, assim como tudo o que veio antes da fogueira e os outros capítulos. Sem fogueira acesa no capítulo, o ponto de volta é a entrada dele. Nível, experiência, equipamentos e inventário nunca regridem. O custo da derrota é o tempo e uma fração do ouro de cada participante da batalha — inclusive de quem saiu antes do fim, para que abandonar não seja a saída barata.

**Grupo desconectado.** Se nenhum jogador que poderia agir (vivo e não saído) estiver conectado, a batalha **pausa** — o grupo não age, os inimigos também não, e nenhum prazo corre — até o primeiro voltar. Se o período de graça de todos vence, todos saem da batalha e ela é perdida, como qualquer abandono.

**Reinício do servidor.** O estado de uma batalha em andamento vive na memória do servidor, que é a fonte da verdade enquanto o processo roda; cada fato da batalha é copiado num diário de batalha no banco. Se o servidor reinicia (atualização ou falha), as batalhas em andamento voltam do diário no ponto em que estavam, com todos os jogadores desconectados — e portanto pausadas — até que reconectem. Se ninguém volta dentro do período de graça, a batalha é cancelada sem custo para ninguém, porque a queda foi do servidor, não do grupo.

---

## 4. Atributos, dano e progressão

### 4.1 Atributos

Os atributos investíveis são três, e a defesa passa a ser um valor derivado — vinda majoritariamente de equipamento, com contribuição menor de Força. Isso evita que investir em defesa seja sempre a escolha ótima.

| Atributo         | Função                                           | Ganho por ponto    |
| ---------------- | ------------------------------------------------ | ------------------ |
| **Força**        | Requisito de armas e armaduras pesadas           | +4 vida, +2 defesa |
| **Destreza**     | Requisito de armas e armaduras leves             | +2 vida, +1 defesa |
| **Inteligência** | Requisito de habilidades e capacidade de energia | +3 energia         |

Cada equipamento exige um valor mínimo de um ou dois atributos para ser equipado, o que direciona a construção do personagem sem travá-la.

O dano que um atributo acrescenta **não é um ganho fixo do atributo**: ele vem da escala declarada em cada arma (seção 4.2) e em cada habilidade de magnitude escalável (seção 5.3). Do mesmo modo, a inteligência não tem um "poder de habilidade" implícito — uma habilidade só cresce com a inteligência se o autor a declarar escalando com ela, o que deixa visível no editor exatamente quanto cada habilidade escala.

A defesa do personagem é `soma da defesa do equipamento + Força × 2 + Destreza × 1`, calculada com os atributos já modificados por buffs e debuffs, e depois ajustada pelos modificadores de defesa. Buffs de atributo afetam dano e defesa, mas **não** vida e energia máximas, que ficam fixas durante a batalha (só a redução de vida máxima mexe nesse teto).

### 4.2 Fórmula de dano

```
DanoBruto = DanoBaseDaArma + (AtributoDaArma × EscalaDaArma)
Redução%  = Defesa / (Defesa + 120)
DanoFinal = DanoBruto × (1 − Redução%)
```

A ordem completa da resolução é: dano bruto → modificadores de dano de quem ataca, `(bruto + saldoFixo) × (1 + saldoPercentual)` (seção 5.5) → redução pela defesa efetiva do alvo → absorção pelo escudo → vida. O resultado é arredondado para baixo, com **mínimo de 1** quando o dano bruto é positivo. Habilidades de dano passam pela mesma cadeia, inclusive pelos buffs de dano. O dano é determinístico: não há crítico nem variação aleatória.

A curva de redução tem retorno decrescente natural e nunca atinge 100%, dispensando teto artificial. Para referência: 60 de defesa reduz cerca de 33% do dano, 120 reduz 50% e 240 reduz 67%.

Vilões usam a mesma redução por defesa. O dano bruto de um ataque de vilão é o **dano base daquele ataque**; força, destreza e inteligência do vilão não entram no cálculo por enquanto, e só a defesa dele é lida. Se o playtest pedir, ataques de vilão podem ganhar atributo e escala opcionais — uma mudança aditiva e compatível.

### 4.3 Vida e energia

Vida e energia base, assim como o ganho por nível, são definidos pelo autor em cada classe da campanha. O sistema oferece faixas recomendadas para manter o balanceamento previsível: de 80 a 120 de vida base, de 40 a 70 de energia base, e um ganho por nível entre 5 e 12 de vida e entre 3 e 8 de energia. A convenção é que vida alta acompanhe energia baixa e vice-versa, de modo que a soma fique próxima entre as classes.

O kit padrão que acompanha a plataforma serve de referência e ponto de partida para quem não quiser criar classes do zero:

| Classe de exemplo | Vida base | Energia base | Ganho por nível      |
| ----------------- | --------- | ------------ | -------------------- |
| Guardião          | 120       | 40           | +12 vida, +3 energia |
| Penitente         | 90        | 50           | +7 vida, +5 energia  |
| Arauto            | 85        | 65           | +6 vida, +7 energia  |
| Sacerdote         | 80        | 70           | +5 vida, +8 energia  |

A energia é recuperada por ataques básicos (cerca de 10 por ataque), por habilidades com efeito de restauração e por consumíveis. Habilidades custam entre 15 e 40 de energia e possuem cooldown medido em rodadas, tipicamente de 2 a 5.

### 4.4 Nível

Cada nível concede **3 pontos de atributo livres** mais o ganho fixo de vida e energia da classe. O jogador distribui os pontos quando quiser, fora de batalha, e o ponto gasto é permanente (não há redistribuição). Quando subir de nível ou investir pontos aumenta a vida ou a energia máximas, a vida e a energia atuais sobem o mesmo tanto: subir de nível não cura por completo, mas também não perde o ganho. Um personagem caído continua caído. Uma batalha pode render vários níveis de uma vez; no nível máximo a experiência para de acumular. O nível máximo sugerido é 20, com a curva de experiência seguindo `XP para o próximo nível = 100 × nível atual` — cem de experiência para sair do nível 1, mil e novecentos para sair do 19, num total de dezenove mil pontos ao longo da campanha inteira.

As quatro habilidades de classe são desbloqueadas progressivamente. O padrão do sistema é liberá-las nos níveis 1, 4, 8 e 13, mas o autor pode definir níveis próprios de desbloqueio por classe.

### 4.5 Fator de relevância — balanceamento de recompensas

O problema do jogador que entra tarde e o problema do farm excessivo são o mesmo fenômeno visto de lados opostos, e podem ser resolvidos por um único mecanismo. Cada nó carrega um nível recomendado, e a diferença entre ele e o nível do jogador determina um multiplicador aplicado a experiência, ouro e chance de drop. O multiplicador é **de cada jogador**: numa mesma batalha, cada participante recebe as recompensas com o fator do próprio nível.

Seja `Δ = NívelRecomendadoDoNó − NívelDoJogador`:

```
Se Δ > 0:  multiplicador = mínimo(3,0 ; 1 + 0,25 × Δ)
Se Δ = 0:  multiplicador = 1,0
Se Δ < 0:  multiplicador = máximo(0,05 ; 1 + 0,20 × Δ)
```

Na prática, um jogador oito níveis abaixo do conteúdo recebe o triplo de recompensa, alcançando o grupo em poucas batalhas sem que ninguém precise repetir conteúdo por ele. Já um jogador cinco níveis acima recebe praticamente nada — a experiência despenca, o ouro seca e os drops somem —, o que torna o farm de conteúdo antigo inútil por si só, sem precisar de bloqueio explícito. Mesmo com o multiplicador, a chance de um drop nunca passa de um teto definido na configuração da plataforma: nenhum item cai sempre.

Microcapítulos repetíveis podem ser criados nos capítulos anteriores especificamente para dar aos jogadores atrasados um lugar onde subir de nível, e o mesmo fator garante que veteranos não tenham motivo para farmá-los.

---

## 5. Classes e habilidades autorais

### 5.1 Princípio

As classes não são fixas: cada campanha define as suas. O autor cria os arquétipos que fizerem sentido para a sua história, com nome, descrição, arte, vida e energia base, ganho por nível e um conjunto de até quatro habilidades. Isso significa que a plataforma não pode entregar habilidades prontas — ela entrega **tipos de efeito genéricos e parametrizáveis**, e o autor combina esses tipos para montar o que quiser. Uma habilidade chamada "Corrente de Ferro" e outra chamada "Grito de Guerra" podem ser, por baixo, o mesmo efeito de provocação com números diferentes.

Como as classes fazem parte do conteúdo autoral, elas seguem o versionamento da seção 2.2: quando uma sala avança para uma versão publicada mais recente, as classes acompanham, mas o portão de compatibilidade garante que uma classe em uso nunca seja removida nem tenha seus atributos-base alterados — ela só ganha conteúdo ou balanceamento. O Perfil de Campanha guarda a referência à classe na versão vigente da sala, e essa referência permanece válida a cada avanço.

Cada classe pertence exclusivamente à campanha onde foi criada e não é reaproveitável entre campanhas, nem mesmo do mesmo autor. Isso mantém a campanha como uma unidade fechada e autossuficiente, sem dependências externas que possam mudar por baixo dela. O kit padrão de quatro classes funciona por **cópia**: ao criar uma campanha, o autor pode importá-lo, e o que ele recebe são quatro classes novas e independentes, livres para edição, e não uma referência a um kit compartilhado.

### 5.2 Limite de vagas por classe

Cada classe carrega um **número máximo de jogadores** que podem escolhê-la numa sala, definido pelo autor. É o que impede que quinze pessoas entrem como a mesma classe de dano e o grupo fique sem quem aguente ataques ou reerga os caídos, e é a única ferramenta que o autor tem para garantir que a composição do grupo faça sentido com o desafio que ele desenhou.

A vaga é ocupada pelo Perfil de Campanha, não pela presença do jogador. Como o perfil persiste enquanto a sala existir, alguém que escolheu uma classe e saiu continua ocupando a vaga ao voltar — ela só é liberada se o jogador abandonar a sala em definitivo. O limite é verificado no momento da escolha, e classes lotadas aparecem na sala de espera marcadas como indisponíveis.

Vale o autor considerar o tamanho de grupo que espera: um limite pensado para dez jogadores pode inviabilizar uma sala de vinte, já que a soma das vagas de todas as classes precisa comportar o grupo inteiro. O editor deve alertar quando essa soma for baixa demais.

### 5.3 Anatomia de uma habilidade

Toda habilidade, independente do efeito, é descrita pelos mesmos campos: **tipo de efeito**, **alvo**, **magnitude**, **duração**, **custo de energia**, **cooldown em rodadas** e **nível de desbloqueio**. Além disso, carrega nome, ícone e texto de exibição, que são puramente cosméticos e ficam a cargo do autor.

Os alvos possíveis são: o próprio personagem, um aliado, todos os aliados, um inimigo, todos os inimigos. A magnitude pode ser um valor fixo, um percentual, ou um valor que escala com um atributo do personagem — o que permite que uma mesma habilidade continue relevante conforme o jogador sobe de nível.

O percentual é um **multiplicador vivo**, não um valor congelado: `+10% de dano` significa sempre dez por cento do dano vigente, recalculado no momento em que o atributo é lido — e não um bônus absoluto fixado no instante do lançamento. Ele incide sobre o valor **base já somado aos modificadores fixos** (atributos + equipamento + buffs/debuffs de valor absoluto), e vários percentuais sobre o mesmo atributo **somam entre si** antes de multiplicar: dois buffs de +20% e +10% resultam em ×1,30 sobre esse subtotal, não em ×1,20 × 1,10. A ordem e o saldo são formalizados na seção 5.5.

### 5.4 Catálogo de tipos de efeito

| Tipo                       | O que faz                                                            | Parâmetros relevantes                  |
| -------------------------- | -------------------------------------------------------------------- | -------------------------------------- |
| **Dano**                   | Causa dano usando a fórmula da seção 4.2                             | Magnitude, atributo de escala, alvo    |
| **Dano contínuo**          | Aplica dano ao fim de cada rodada do grupo, por N rodadas            | Magnitude por rodada, duração          |
| **Cura**                   | Restaura vida                                                        | Magnitude, alvo                        |
| **Cura contínua**          | Restaura vida por rodada durante N rodadas                           | Magnitude por rodada, duração          |
| **Reerguer**               | Devolve um aliado caído ao combate                                   | Percentual de vida recuperada          |
| **Restaurar energia**      | Devolve energia                                                      | Magnitude, alvo                        |
| **Provocar**               | Redireciona o próximo ataque inimigo, convertendo área em alvo único | Duração                                |
| **Escudo**                 | Absorve uma quantidade de dano antes que ele atinja a vida           | Magnitude, duração                     |
| **Buff de atributo**       | Aumenta força, destreza, inteligência, dano ou defesa                | Atributo, magnitude, duração, alvo     |
| **Debuff de atributo**     | Reduz os mesmos valores no inimigo                                   | Atributo, magnitude, duração, alvo     |
| **Redução de vida máxima** | Diminui o teto de vida do alvo                                       | Magnitude, duração, alvo               |
| **Atordoar**               | Faz o alvo perder o próximo turno                                    | Duração                                |
| **Dissipar**               | Remove efeitos ativos do alvo                                        | Quantidade, se remove buffs ou debuffs |

Esse catálogo cobre o vocabulário clássico de RPG por turnos e é suficiente para reconstruir qualquer uma das quatro classes de exemplo. Novos tipos podem ser acrescentados depois sem quebrar as campanhas existentes, já que cada habilidade referencia apenas o tipo que usa.

### 5.5 Regras de empilhamento

Cada atributo modificável é resolvido em duas camadas, sempre na mesma ordem: primeiro os **modificadores fixos** (valores absolutos) somam-se ao valor base; depois os **modificadores percentuais** — somados entre si com sinal — multiplicam esse subtotal. Com `netFlat` sendo o saldo dos modificadores fixos e `netPct` o saldo dos percentuais, o valor final é `(base + netFlat) × (1 + netPct)`, arredondado para baixo. Nos dois canais, buff soma e debuff subtrai: um buff de +20% de dano contra um debuff de −10% resulta em +10% de saldo.

O empilhamento tem **duas políticas**, por tipo de efeito. **Modificadores de atributo** (buff e debuff) **coexistem e somam**: cada aplicação é uma entrada independente, com sua própria duração, e o saldo (`netFlat`/`netPct`) é calculado no momento da leitura — três aliados aplicando +10% de dano resultam em +30%. Não há teto imposto pelo sistema; o autor controla o acúmulo pela magnitude, pelo custo de energia, pelo cooldown e pela duração das habilidades. **Todos os demais efeitos persistentes** — atordoar, redução de vida máxima, provocar, escudo, dano contínuo e cura contínua — **não somam**: uma nova aplicação sobre o mesmo alvo substitui a anterior e reinicia a duração.

A assimetria é deliberada. Modificadores de atributo compõem-se de forma aditiva e previsível, e o único abuso possível — empilhar o mesmo buff — é problema de balanceamento que o autor resolve com os custos. Já os efeitos de controle e duração não têm esse freio: somar a duração de dois atordoamentos de aliados diferentes tornaria a batalha impossível (seção 5.6), e esse abuso viria da coordenação de várias fontes, não da magnitude de uma habilidade — algo que o autor não teria como conter. Para esses, o sistema garante o teto substituindo em vez de acumular.

**Relógio dos efeitos.** Toda duração e todo cooldown de habilidade contam em **rodadas do grupo** — uma rodada é um turno do grupo. Ao fim de cada turno do grupo (ação executada, resposta errada ou tempo esgotado), os efeitos contínuos (dano e cura) aplicam um tique em todos os alvos, durações e cooldowns decrementam e os efeitos que chegam a zero expiram. Um relógio só faz a duração valer o mesmo independentemente do tamanho da fila de inimigos: um dano contínuo de 3 rodadas causa 3 tiques mesmo contra 3 vilões. **A rodada em que um efeito é aplicado, ou em que uma habilidade é usada, não conta:** uma duração de N rodadas cobre as N rodadas seguintes (um buff de 3 rodadas vale para as próximas 3 ações do grupo; um dano contínuo de 3 rodadas tica ao fim delas), e um cooldown de N rodadas deixa a habilidade indisponível nas N rodadas seguintes — usada na rodada 5 com cooldown 3, ela volta na rodada 9. Três efeitos contam outra coisa, por natureza: **atordoar** conta turnos perdidos do próprio alvo, **provocar** conta ataques inimigos redirecionados, e o cooldown dos **ataques de vilão** conta turnos daquele vilão (seção 3.5).

O que `percent` significa em cada tipo de efeito está fixado em `docs/phase-1b-kit-draft.md`; em particular, dano percentual é uma porcentagem do dano bruto do ataque básico de quem lança.

### 5.6 Validação no editor

O editor precisa impedir configurações que quebrem o jogo, e é aqui que a liberdade autoral exige contrapeso. Habilidades com custo de energia zero e cooldown zero devem ser bloqueadas, assim como magnitudes fora das faixas recomendadas sem confirmação explícita do autor. Efeitos de atordoar e de redução de vida máxima merecem limite de duração, porque encadeados podem tornar uma batalha impossível ou trivial.

Vale também exibir ao autor uma estimativa de dano por rodada da classe que ele está montando, comparada com o kit padrão, para que ele perceba desvios grosseiros antes de publicar.

---

## 6. Economia e itens

**Recompensas.** Cada vilão define quanta experiência e quanto ouro vale e uma tabela de drops: os itens que ele pode deixar cair, cada um com uma chance. Uma batalha vale a soma dos inimigos que a compõem. Só a vitória dá recompensa, e ela é **de cada participante**: todos que estavam na batalha no fim — inclusive os caídos — recebem a experiência e o ouro inteiros, multiplicados pelo próprio fator de relevância (seção 4.5), e cada um sorteia os drops para si. Nada é dividido pelo tamanho do grupo, para que jogar junto nunca renda menos. Quem saiu da batalha antes do fim não recebe nada.

**Drops são raros.** Nenhum drop é garantido. O autor escolhe a chance de cada item a partir de faixas — comum, incomum e rara —, e a chance final, já com o fator de relevância, tem um teto. Itens simples ficam nas faixas comuns e itens bons nas raras; o ouro, e portanto a loja, é a fonte principal de equipamento.

**Ouro e itens são de cada jogador.** Não há bolsa do grupo: o ouro e os itens que um jogador ganha ou compra são dele, e o ouro de cada um é privado. Os itens ficam no inventário pessoal até serem equipados ou consumidos.

**Troca entre jogadores.** Jogadores da mesma sala podem dar, vender e trocar ouro e itens entre si por meio de uma **oferta**: quem oferece diz o que dá (ouro e/ou itens) e o que pede em troca (ouro e/ou itens do outro). Um presente é uma oferta que não pede nada; uma venda dá um item e pede ouro; uma troca dá item por item, com ou sem ouro na diferença. **Toda oferta precisa do aceite do outro jogador**, inclusive o presente. Ao aceitar, os dois lados são conferidos de novo e tudo se move de uma vez — nunca pela metade; se um dos lados já não tem o que prometeu, a troca é recusada sem revelar quanto ouro falta. Só entram itens do inventário (um item equipado precisa ser desequipado antes), e ninguém troca enquanto está numa batalha.

**Loja.** Nos nós de loja, cada jogador compra com o próprio ouro, sem votação. A loja não tem estoque limitado, e o preço é o do item na versão da campanha que a sala está jogando.

**Uso.** Equipar, desequipar, trocar entre os próprios slots e consumir são ações livres do dono, fora de batalha. Equipar exige os requisitos de atributo do item (seção 4.1); o slot de arma só é trocado, nunca esvaziado. Fora de batalha, só fazem efeito os consumíveis que não dependem de combate: curar e restaurar energia do próprio personagem, e reerguer um aliado caído da sala. Os demais consumíveis só são usados em batalha, onde gastam a ação do grupo.

Slots de equipamento: arma, capacete, peitoral, botas, braceletes e anéis. Todos os itens são de raridade "normal" nesta versão (a raridade de um drop é só a sua chance); um sistema de tiers e a venda de itens à loja ficam para depois.

Jogadores começam apenas com a arma base de sua classe.

---

## 7. Salas e ciclo de vida

A sala é criada por um usuário a partir de qualquer campanha publicada. Ele se torna o mestre e pode transferir esse papel a outro jogador. A sala pode ser pública ou privada com código de acesso, e permanece viva por tempo indeterminado — jogadores entram e saem livremente, e seus Perfis de Campanha persistem entre sessões. A sala acompanha a campanha: avança automaticamente para a versão publicada mais recente em ponto seguro — entre batalhas ou numa fogueira, nunca durante uma batalha — recebendo capítulos e correções sem ação do mestre e sem perder progresso (ver seção 2.2).

Ao entrar pela primeira vez, o jogador escolhe a classe entre as que a campanha oferece e que ainda tenham vaga, o que define seus valores base de vida e energia. Um jogador que entra numa sala já avançada começa no nível 1; o fator de relevância da seção 4.5 é o que torna essa entrada tardia viável.

Quando o chefe do último capítulo é derrotado, a sala é marcada como concluída, mas o encerramento efetivo é decisão do mestre: até lá a sala continua jogável — lojas, trocas e batalhas opcionais — e, se a campanha publicar um capítulo novo, a sala o recebe e volta a estar em andamento. É no encerramento que o histórico é gravado: a campanha, se foi concluída, e os dados finais do personagem de cada participante. Cada jogador vê no próprio histórico as campanhas encerradas de que participou.

Uma queda de conexão não é uma saída. O jogador que cai no meio de uma batalha — recarregou a página, trocou de app no celular, perdeu a rede — tem um **período de graça** para voltar e continuar na mesma batalha, no mesmo estado que os outros veem. Enquanto está fora, não pode tocar no sinal, mas continua sendo alvo; se o turno esperava por ele, o prazo daquela etapa corre normalmente. Passado o período de graça, ele é removido da batalha e não pode retornar a ela. Sair de propósito ("Sair da batalha") remove na hora. Em qualquer caso, ao reconectar ele volta normalmente à sala, com seu perfil intacto, incluindo o estado de caído se estava caído.

O mestre pode **reiniciar** uma batalha em andamento: ela é descartada sem gravar nada e uma formação nova abre no mesmo nó com os participantes que não tinham saído. Cancelar uma batalha em andamento também é do mestre; sem ele presente, só com a confirmação de todos os participantes conectados — para que cancelar não seja a fuga de uma derrota.

---

## 8. Plano de desenvolvimento

**Fase 0 — Modelagem e fundação.** Modelo de dados completo, esquema de versionamento de campanha, autenticação. Toda a parametrização de balanceamento (tabelas de atributos, constante da fórmula de dano, curva de XP, fator de relevância) deve viver em arquivo de configuração desde o primeiro dia, porque esses números vão mudar a cada playtest.

**Fase 1 — Autoria.** CRUD de campanhas, editor de capítulos, editor do grafo de nós com tipos e marcação de obrigatório/opcional, cadastro de vilões com listas de ataque, banco de perguntas objetivas e abertas, upload de mídia, fluxo de publicação.

**Fase 1b — Editor de classes e habilidades.** Motor de efeitos genéricos, editor de classes com vida e energia base, montagem de habilidades a partir do catálogo de efeitos, validações e limites, limite de vagas por classe, kit padrão de quatro classes importável por cópia. Esta fase é pré-requisito do motor de combate: as habilidades precisam existir como dados antes que o combate possa executá-las.

**Fase 2 — Salas.** Criação pública e privada, código de acesso, sala de espera com seleção de classe e controle de vagas, entrada e saída livres, transferência de mestre, encerramento.

**Fase 3 — Motor de combate.** É a parte de maior risco técnico e a que mais depende de teste com pessoas reais. Fila de iniciativa, sinal com rotação, dois modos de pergunta, HP e energia, resolução dos efeitos do catálogo com duração e empilhamento, cooldowns, alvo dos inimigos, fórmula de dano, morte e reerguer.

**Fase 4 — Progressão e economia.** XP, nível, distribuição de pontos, desbloqueio de habilidades, fator de relevância, loot, ouro, troca entre jogadores, loja, inventário e equipamentos.

**Fase 5 — Fluxo de capítulo.** Vídeos de abertura, desbloqueio por conclusão (inclusive do chefe), fogueiras e snapshot, conclusão de campanha, histórico.

**Fase 6 — Robustez ao vivo.** Sincronização em tempo real, tratamento de desconexão, reinício de batalha, garantia de que todo o estado de combate resida no servidor.

Recomendo um protótipo vertical logo após a Fase 0: uma campanha fixa, um capítulo, uma batalha, combate funcionando de ponta a ponta com perguntas objetivas. Vale mais do que qualquer quantidade de planejamento adicional para validar o ritmo do sinal e do turno compartilhado.

---

## 9. Pendências em aberto

As habilidades do kit padrão foram definidas em `docs/phase-1b-kit-draft.md`. O papel do mestre como jogador e a queda do mestre no meio de uma batalha com pergunta aberta foram decididos no plano da Fase 3 (`docs/phase-3-plan.md`) e estão na seção 3.2. Não há pendências de regra em aberto.
