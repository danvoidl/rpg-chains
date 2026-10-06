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
| **Perfil de Campanha** | Personagem do jogador na sala. Nível, atributos, HP, energia, equipamentos, inventário.                                                                 |
| **Bolsa do Grupo**     | Ouro e itens compartilhados da sala, distribuídos por votação.                                                                                          |
| **Batalha Ativa**      | Estado transitório de uma luta em andamento. Fonte da verdade no servidor.                                                                              |
| **Histórico**          | Registro permanente de campanhas encerradas e do personagem do usuário nelas.                                                                           |

### 2.2 Versionamento de campanha

O criador da campanha e o dono da sala são pessoas diferentes, e o criador não tem visibilidade nem controle sobre salas de terceiros que estejam jogando seu conteúdo. Por isso a edição é resolvida por **publicação por versão**: a campanha mantém um rascunho sempre editável e um histórico de versões publicadas, cada uma imutável. O criador edita o rascunho livremente e publica quando quiser — para lançar capítulos novos, corrigir uma pergunta com bug ou rebalancear números.

Ao contrário de um modelo de sala congelada, as salas em andamento **acompanham** a última versão publicada: cada sala guarda um ponteiro para a versão que está jogando e o avança automaticamente para a mais recente **em ponto seguro** — entre batalhas ou numa fogueira, nunca no meio de uma batalha (uma batalha em andamento termina na versão em que começou, o que preserva o determinismo do replay descrito na seção 3). Não há ação do mestre: o autor "empurra" publicando, e as salas rolam para frente sozinhas, recebendo conteúdo novo e correções sem perder progresso.

Como o autor não enxerga as salas de terceiros, quem garante que esse avanço é seguro não é o julgamento dele, e sim um **portão de compatibilidade** na publicação. A partir da segunda publicação, cada versão é validada contra a anterior e só é aceita se for **retrocompatível** — mudanças aditivas e correções não-quebrantes passam; mudanças que invalidariam um personagem em jogo são recusadas, e a publicação falha listando as violações. A regra vale sempre após o primeiro publish, exista ou não uma sala viva, para dar previsibilidade ao autor; o primeiro publish avisa esse contrato. Capítulos marcados como "em construção" permanecem no rascunho e não entram na versão publicada, o que dispensa qualquer mecanismo separado para eles — e são o palco natural para preparar um capítulo antes de liberá-lo.

#### 2.2.1 O que a publicação permite e proíbe após o primeiro publish

O critério é o que um personagem em jogo (Perfil de Campanha) e o log de batalha referenciam: o id da classe, o conjunto de habilidades da classe, os ids de itens equipados e no inventário, e os ids de nós, perguntas e vilões.

**Permitido** (a versão nova rola para a sala com segurança):

- Adicionar conteúdo: capítulos, nós, arestas, classes, vilões, ataques, perguntas, itens e habilidades a uma classe.
- Editar texto e arte: enunciados, nomes, descrições, ícones, imagens e vídeos.
- Corrigir uma pergunta: alternativas e resposta correta.
- Balancear números de vilão, habilidade e item: vida, atributos, dano base, custo de energia, cooldown, nível de desbloqueio e a magnitude/duração do efeito de uma habilidade. É seguro porque o perfil não guarda os números da habilidade — o motor os lê da versão vigente no momento do uso, e o avanço nunca acontece no meio de uma batalha.
- Aumentar o limite de vagas de uma classe.

**Proibido** (o portão recusa):

- Deletar qualquer entidade referenciável por id: classe, habilidade, pergunta, item, vilão ou nó.
- Alterar os atributos-base de uma classe (vida e energia base, ganho por nível, arma base), pois eles definem os valores derivados de personagens que já existem.
- Reduzir o limite de vagas de uma classe.
- Remover uma habilidade de uma classe — o conjunto é só-adição; rebalancear uma habilidade existente é permitido.
- Quebrar a estrutura do grafo: remover um nó ou aresta de modo a tornar inalcançável um nó antes alcançável, ou remover o nó de entrada ou o de chefe.

Curva de XP, constante de dano e fator de relevância vivem na configuração da plataforma (seção 4), não no conteúdo autoral, e portanto não fazem parte deste versionamento; alterá-los é um evento de plataforma, não de publicação de campanha.

### 2.3 Grafo do capítulo

Cada capítulo é um grafo direcionado em forma de árvore invertida: múltiplos caminhos partindo de uma entrada e convergindo para o nó de chefe. Cada nó carrega o tipo, os pré-requisitos de desbloqueio, a marcação de obrigatório ou opcional, o limite de jogadores e um **nível recomendado** — este último é o parâmetro central do balanceamento descrito na seção 4.5.

Os nós de batalha respeitam um limite de participantes definido pelo criador. Salas de chefe não têm limite. Os jogadores escolhem livremente de qual nó participar, respeitando a lotação, e uma vez dentro de uma batalha não podem trocar até que ela termine.

O capítulo é concluído quando todas as batalhas obrigatórias forem vencidas. O chefe, porém, só é liberado quando o mestre da sala decidir liberá-lo, mesmo que os pré-requisitos já estejam cumpridos.

---

## 3. Sistema de combate

### 3.1 Ordem de ação

A iniciativa é sorteada no início da batalha, definindo se o grupo ou os inimigos agem primeiro. A partir daí o ciclo alterna estritamente: um inimigo age, o grupo age, o próximo inimigo age, o grupo age novamente. Os inimigos formam uma fila circular — quem acabou de agir vai para o fim dela — de modo que com múltiplos vilões cada um age em intervalos regulares em vez de todos agirem de uma vez.

Quando chega a vez do grupo, um sinal é exibido a todos os participantes da batalha junto com uma pergunta. O primeiro jogador a tocar no sinal ganha o direito de responder. Se acertar, executa uma ação; se errar, a vez passa imediatamente para o próximo inimigo da fila e nenhum outro jogador tem chance de tentar.

### 3.2 Perguntas e julgamento

Existem dois tipos de pergunta. As **objetivas** são de múltipla escolha e validadas automaticamente pelo sistema, dispensando a presença do mestre. As **abertas** exigem que o mestre avalie a resposta e aprove ou reprove manualmente; ele pode cadastrá-las antes da batalha e acrescentar novas durante o combate, e os jogadores veem apenas o que ele exibir.

Como há um só mestre e o grupo pode se dividir em ramos simultâneos, perguntas abertas ficam restritas a batalhas de caminho único e a chefes. Ramos paralelos usam obrigatoriamente perguntas objetivas, de modo que várias batalhas possam correr ao mesmo tempo sem depender da atenção do mestre. O editor de campanha valida essa regra e avisa o criador quando ele configurar uma pergunta aberta num nó que pertence a um ramo paralelo.

### 3.3 Rotação da campainha

Um jogador que agiu numa rodada fica bloqueado do sinal na rodada seguinte. Isso garante rotação sem impedir que o grupo escolha quem age em momentos críticos. Jogadores mortos ou desconectados saem da lista de elegíveis; se em algum momento não restar nenhum jogador elegível, o bloqueio é ignorado e todos os vivos voltam a poder responder.

Habilidades que não causam dano — provocar, curar, reerguer, aplicar buff — contam como a ação da rodada da mesma forma que um ataque, e portanto também bloqueiam quem as usou na rodada seguinte.

### 3.4 Ações disponíveis

Ao acertar a pergunta, o jogador escolhe uma entre: **atacar** com a arma equipada, **usar uma habilidade** (paga energia e respeita o cooldown), ou **usar um consumível** do próprio inventário. Todas consomem a ação do grupo naquela rodada.

Buffs e curas consomem a ação normalmente. Isso é intencional: um buff de dano expressivo aplicado no personagem certo, seguido de um ataque crítico, compensa a rodada gasta.

### 3.5 Ataques inimigos

Cada vilão tem uma lista de ataques configurável pelo criador da campanha, contendo dano base, tipo de alvo (único ou área) e frequência ou cooldown. Ataques de alvo único selecionam aleatoriamente entre os jogadores vivos da batalha; ataques em área atingem todos.

### 3.6 Provocação

Provocar é um dos efeitos genéricos disponíveis para o autor da campanha montar habilidades defensivas. Quem usa gasta a ação do grupo e força o próximo ataque inimigo a ser redirecionado para si; se esse ataque for em área, ele se converte em ataque único contra o provocador. Trocar a ação da rodada por anular um ataque em área é o que dá função a qualquer classe construída em torno de aguentar dano.

_Parâmetro de ajuste: se em testes a provocação se mostrar fraca diante de filas longas de inimigos, a duração padrão pode passar de "um ataque" para "duas rodadas"._

### 3.7 Morte, revive e derrota total

Um jogador com HP zerado fica caído: não age, não responde ao sinal e não pode ser alvo. O estado de caído é gravado no Perfil de Campanha, não na sessão — sair e reconectar não ressuscita ninguém.

Habilidades com efeito de reerguer devolvem aliados caídos ao combate, gastando a ação do grupo — cabe ao autor da campanha decidir quais classes têm acesso a elas, e se alguma tem. Fora de combate, nós de fogueira reerguem todos os caídos e restauram HP e energia.

Se todos os jogadores de uma batalha caírem, a batalha é perdida e o grupo é devolvido automaticamente à última fogueira ativada, sem necessidade de percorrer o caminho. O snapshot da fogueira restaura **apenas o estado de combate**: HP, energia, caídos reerguidos e reset dos nós de batalha do capítulo atual. Nível, experiência, equipamentos e inventário nunca regridem. O custo da derrota é o tempo e uma fração do ouro da bolsa.

---

## 4. Atributos, dano e progressão

### 4.1 Atributos

Os atributos investíveis são três, e a defesa passa a ser um valor derivado — vinda majoritariamente de equipamento, com contribuição menor de Força. Isso evita que investir em defesa seja sempre a escolha ótima.

| Atributo         | Função                                           | Ganho por ponto                                 |
| ---------------- | ------------------------------------------------ | ----------------------------------------------- |
| **Força**        | Requisito de armas e armaduras pesadas           | +4 vida, +2 defesa, +1,5 dano com armas pesadas |
| **Destreza**     | Requisito de armas e armaduras leves             | +2 vida, +1 defesa, +2 dano com armas leves     |
| **Inteligência** | Requisito de habilidades e capacidade de energia | +3 energia, +2 poder de habilidade              |

Cada equipamento exige um valor mínimo de um ou dois atributos para ser equipado, o que direciona a construção do personagem sem travá-la.

### 4.2 Fórmula de dano

```
DanoBruto = DanoBaseDaArma + (AtributoDaArma × EscalaDaArma)
Redução%  = Defesa / (Defesa + 120)
DanoFinal = DanoBruto × (1 − Redução%)
```

A curva de redução tem retorno decrescente natural e nunca atinge 100%, dispensando teto artificial. Para referência: 60 de defesa reduz cerca de 33% do dano, 120 reduz 50% e 240 reduz 67%.

Vilões usam a mesma fórmula, com atributos próprios definidos pelo criador da campanha.

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

Cada nível concede **3 pontos de atributo livres** mais o ganho fixo de vida e energia da classe. O nível máximo sugerido é 20, com a curva de experiência seguindo `XP para o próximo nível = 100 × nível atual` — cem de experiência para sair do nível 1, mil e novecentos para sair do 19, num total de dezenove mil pontos ao longo da campanha inteira.

As quatro habilidades de classe são desbloqueadas progressivamente. O padrão do sistema é liberá-las nos níveis 1, 4, 8 e 13, mas o autor pode definir níveis próprios de desbloqueio por classe.

### 4.5 Fator de relevância — balanceamento de recompensas

O problema do jogador que entra tarde e o problema do farm excessivo são o mesmo fenômeno visto de lados opostos, e podem ser resolvidos por um único mecanismo. Cada nó carrega um nível recomendado, e a diferença entre ele e o nível do jogador determina um multiplicador aplicado a experiência, ouro e chance de drop.

Seja `Δ = NívelRecomendadoDoNó − NívelDoJogador`:

```
Se Δ > 0:  multiplicador = mínimo(3,0 ; 1 + 0,25 × Δ)
Se Δ = 0:  multiplicador = 1,0
Se Δ < 0:  multiplicador = máximo(0,05 ; 1 + 0,20 × Δ)
```

Na prática, um jogador oito níveis abaixo do conteúdo recebe o triplo de recompensa, alcançando o grupo em poucas batalhas sem que ninguém precise repetir conteúdo por ele. Já um jogador cinco níveis acima recebe praticamente nada — a experiência despenca, o ouro seca e os drops somem —, o que torna o farm de conteúdo antigo inútil por si só, sem precisar de bloqueio explícito.

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
| **Dano contínuo**          | Aplica dano no início do turno do alvo por N rodadas                 | Magnitude por rodada, duração          |
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

### 5.6 Validação no editor

O editor precisa impedir configurações que quebrem o jogo, e é aqui que a liberdade autoral exige contrapeso. Habilidades com custo de energia zero e cooldown zero devem ser bloqueadas, assim como magnitudes fora das faixas recomendadas sem confirmação explícita do autor. Efeitos de atordoar e de redução de vida máxima merecem limite de duração, porque encadeados podem tornar uma batalha impossível ou trivial.

Vale também exibir ao autor uma estimativa de dano por rodada da classe que ele está montando, comparada com o kit padrão, para que ele perceba desvios grosseiros antes de publicar.

---

## 6. Economia e itens

Ouro e itens obtidos em batalha vão para a **bolsa do grupo**, não para inventários pessoais. A distribuição acontece por votação de maioria simples entre os jogadores presentes na sala.

Compras em nós de loja funcionam por **lote**: o grupo monta uma lista de compras coletiva e vota uma única vez sobre ela, evitando dezenas de votações consecutivas. A loja não tem estoque limitado.

A compra e a repartição são etapas separadas. Tudo que é comprado entra primeiro na bolsa do grupo, junto com o que caiu dos inimigos, e só depois o grupo decide, item a item, para quem cada coisa vai. Essa transferência da bolsa compartilhada para o inventário individual é o momento em que o item deixa de ser coletivo e passa a pertencer ao personagem. Separar as duas etapas permite que o grupo compre em massa sem precisar decidir destinatários no calor da votação, e que remaneje o que já está na bolsa a qualquer momento.

A distinção que rege toda a economia é entre **aquisição** e **uso**. Adquirir — comprar na loja ou retirar um item da bolsa do grupo — é decisão coletiva e passa por votação, porque o recurso pertence ao grupo. Depois que um item foi atribuído a um jogador, ele passa a ser propriedade daquele personagem: equipar, desequipar, trocar entre os próprios slots e consumir poções são ações livres, sem votação e sem restrição.

Slots de equipamento: arma, capacete, peitoral, botas, braceletes e anéis. Consumíveis ficam em inventário pessoal e usá-los consome a ação do grupo. Todos os itens são de raridade "normal" nesta versão; um sistema de tiers e troca entre jogadores fica para depois.

Jogadores começam apenas com a arma base de sua classe.

---

## 7. Salas e ciclo de vida

A sala é criada por um usuário a partir de qualquer campanha publicada. Ele se torna o mestre e pode transferir esse papel a outro jogador. A sala pode ser pública ou privada com código de acesso, e permanece viva por tempo indeterminado — jogadores entram e saem livremente, e seus Perfis de Campanha persistem entre sessões. A sala acompanha a campanha: avança automaticamente para a versão publicada mais recente em ponto seguro — entre batalhas ou numa fogueira, nunca durante uma batalha — recebendo capítulos e correções sem ação do mestre e sem perder progresso (ver seção 2.2).

Ao entrar pela primeira vez, o jogador escolhe a classe entre as que a campanha oferece e que ainda tenham vaga, o que define seus valores base de vida e energia. Um jogador que entra numa sala já avançada começa no nível 1; o fator de relevância da seção 4.5 é o que torna essa entrada tardia viável.

Quando o chefe final é derrotado, a campanha é marcada como cumprida, mas o encerramento efetivo da sala é decisão do mestre. É no encerramento que o histórico é gravado: campanha concluída e os dados finais do personagem de cada participante.

Em caso de queda de conexão, o jogador é removido da batalha em andamento e não pode retornar a ela; o grupo pode reiniciar a batalha. Ao reconectar, ele volta normalmente à sala, com seu perfil intacto, incluindo o estado de caído se estava caído.

---

## 8. Plano de desenvolvimento

**Fase 0 — Modelagem e fundação.** Modelo de dados completo, esquema de versionamento de campanha, autenticação. Toda a parametrização de balanceamento (tabelas de atributos, constante da fórmula de dano, curva de XP, fator de relevância) deve viver em arquivo de configuração desde o primeiro dia, porque esses números vão mudar a cada playtest.

**Fase 1 — Autoria.** CRUD de campanhas, editor de capítulos, editor do grafo de nós com tipos e marcação de obrigatório/opcional, cadastro de vilões com listas de ataque, banco de perguntas objetivas e abertas, upload de mídia, fluxo de publicação.

**Fase 1b — Editor de classes e habilidades.** Motor de efeitos genéricos, editor de classes com vida e energia base, montagem de habilidades a partir do catálogo de efeitos, validações e limites, limite de vagas por classe, kit padrão de quatro classes importável por cópia. Esta fase é pré-requisito do motor de combate: as habilidades precisam existir como dados antes que o combate possa executá-las.

**Fase 2 — Salas.** Criação pública e privada, código de acesso, sala de espera com seleção de classe e controle de vagas, entrada e saída livres, transferência de mestre, encerramento.

**Fase 3 — Motor de combate.** É a parte de maior risco técnico e a que mais depende de teste com pessoas reais. Fila de iniciativa, sinal com rotação, dois modos de pergunta, HP e energia, resolução dos efeitos do catálogo com duração e empilhamento, cooldowns, alvo dos inimigos, fórmula de dano, morte e reerguer.

**Fase 4 — Progressão e economia.** XP, nível, distribuição de pontos, desbloqueio de habilidades, fator de relevância, loot, bolsa do grupo, votação, loja por lote, inventário e equipamentos.

**Fase 5 — Fluxo de capítulo.** Vídeos de abertura, desbloqueio por conclusão, liberação manual do chefe, fogueiras e snapshot, conclusão de campanha, histórico.

**Fase 6 — Robustez ao vivo.** Sincronização em tempo real, tratamento de desconexão, reinício de batalha, garantia de que todo o estado de combate resida no servidor.

Recomendo um protótipo vertical logo após a Fase 0: uma campanha fixa, um capítulo, uma batalha, combate funcionando de ponta a ponta com perguntas objetivas. Vale mais do que qualquer quantidade de planejamento adicional para validar o ritmo do sinal e do turno compartilhado.

---

## 9. Pendências em aberto

As decisões estruturais estão fechadas. Resta um ponto de detalhamento, que é trabalho de balanceamento e não de arquitetura: a montagem concreta das quatro habilidades de cada classe do kit padrão, usando o catálogo da seção 5.4.
