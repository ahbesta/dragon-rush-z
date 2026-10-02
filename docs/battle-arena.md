# Arena de combate

O combate continua sendo resolvido e salvo pelo servidor. A arena reproduz os eventos recebidos em cenários 2D, com sprites, golpes físicos, carga e disparo de Ki, impactos, dano, mudança de fase do boss e resultado. O modo manual permite escolher a próxima técnica; o automático reproduz a luta já calculada. Trocar de modo mantém a mesma batalha.

## Organização

- `src/game/combat.ts`: motor autoritativo, eventos e recursos iniciais da luta.
- `src/lib/battle-presentation.ts`: converte ataque/dano em quadros visuais. Usa `remainingHp`/`remainingKi` recebidos; não calcula dano, drops ou recompensas.
- `src/components/use-battle-playback.ts`: fila de quadros novos, velocidade, replay e cancelamento de timers. Uma luta manual retomada mostra o estado salvo sem repetir rodadas anteriores.
- `src/components/battle-arena.tsx`: cenário, dois lutadores, HUD, efeitos e controles. As técnicas continuam validadas no servidor.
- `src/app/battle-arena.css`: movimentos e efeitos responsivos, respeitando `prefers-reduced-motion`.
- `src/lib/game-art.ts`: associação entre IDs, cenários e folhas de sprites. Não contém atributos de jogo.

As opções 1x/2x/3x, pular e rever alteram somente a apresentação. Elas não enviam ações de jogo, aceleram cooldowns ou repetem recompensas. A velocidade fica em `localStorage`, com validação e fallback para 1x caso o armazenamento esteja indisponível. Enquanto uma rodada manual está sendo animada, os comandos aguardam o fim da reprodução; é possível pular a animação ou trocar de modo.

## HUD, comandos e turnos

`battle-command-menu.tsx` reutiliza as ações existentes: Soco, técnicas, consumíveis, defesa e concentração. A faixa fica abaixo do campo, com submenus, foco sem rolagem e navegação por setas/Escape. Soco aparece somente em Atacar. Ki, cooldowns, quantidade, disponibilidade e consumo de ação continuam vindo do servidor.

`combat-timeline.ts` apresenta a iniciativa publicada pelo servidor enquanto aguarda uma escolha, ou a sequência real dos eventos durante a reprodução. Não prevê rodadas futuras. O painel fica integrado no canto direito da HUD e permite consultar movimentos recentes. Avatares na ordem de turnos e no histórico destacam o combatente correspondente por mouse, teclado ou toque.

Os contêineres `.arena-team` reservam metade do campo para cada equipe, preservando as âncoras e tamanhos atuais quando há um combatente. Formações visuais usam células separadas e mais altura em telas estreitas; `--formation-rows` dimensiona as linhas e a altura para quantidades maiores sem trocar a estrutura. O motor continua sendo 1 × 1. Indicadores de turno ficam sob os pés e nas etiquetas. Golpes, flashes vermelhos e explosões de Ki são efeitos visuais dos eventos existentes, respeitando movimento reduzido.

`battle-navigation-notice.tsx` usa um diálogo nativo com foco contido e Escape. `GameShell` impede trocar de seção, abrir Perfil ou sair da conta enquanto houver `activeBattle`. Fechar o aviso devolve o foco à arena sem rolar a página. Recarregar ou receber uma luta pendente em outra aba retoma a seção de combate. A confirmação de conclusão libera o menu.

`combat-access.ts` centraliza a exigência da primeira vitória manual de cada boss. O servidor consulta a flag persistida `defeated:ID`, concedida na transação de vitória; derrotas, empates e vitórias contra outra variante não liberam automático.

## Escolha de área e chegada à arena

`battle-destinations.tsx` mostra a área selecionada e seus adversários. O botão **Trocar área** abre um diálogo nativo, com busca, filtro de disponíveis e acesso às áreas bloqueadas para consultar requisitos. Escape fecha o diálogo e devolve o foco ao botão. Exploração permite encontrar um inimigo aleatório ou escolher um diretamente. Os bosses continuam nas próprias áreas; o atalho de Piccolo na tela inicial seleciona o Castelo do Rei.

Quando o servidor confirma o início de uma nova luta, a página leva o foco e a rolagem à arena. Isso ocorre uma vez por ID de batalha, somente em ações de início: `battle`, `boss` e `explore`. Turnos, poções, conclusão e mudanças de modo não deslocam a página. Ao substituir os comandos por um resultado menor, a altura mínima da página preserva a posição do viewport; navegação explícita e uma nova luta liberam essa reserva. Uma luta retomada seleciona a área registrada no combate.

Combates iniciados em **Explorar** preservam essa seção, a área selecionada e o botão de exploração durante e depois da luta, inclusive em modo manual e ao trocar de modo. A navegação automática para **Batalhar** ocorre somente quando uma ação de combate parte de outra seção.

## Log e drops

O histórico manual fica aberto dentro da arena. A rolagem automática acompanha o final do log dentro de seu próprio painel; consultar eventos anteriores pausa esse acompanhamento. Resultado, XP, Zeni e drops permanecem na mesma arena ao concluir, sem um segundo painel de batalha separado das escolhas de área.

`battle-loot-reveal.tsx` apresenta cada drop confirmado pelo servidor no centro do cenário, após a reprodução terminar ou ser pulada. Itens comuns têm luz suave; incomuns usam verde e partículas; raros usam azul e ondas de energia; épicos usam violeta, brilho e partículas mais intensas. Mostra arte, quantidade, nome e raridade do catálogo, com avanço automático ou manual e opção de fechar por Escape. **Ver drops** repete só a apresentação; não envia requisições nem concede itens novamente. Movimento reduzido conserva as informações sem animações. Recarregar uma luta antiga não repete o anúncio automaticamente.

O círculo principal mantém seu tamanho e centro. O halo pulsa em uma camada separada, e a flutuação move o conjunto completo de círculo e item. A apresentação remove a margem herdada dos cartões de inventário.

O tempo de exibição de cada drop começa após a arte carregar, com um indicador durante a revelação. Uma imagem lenta não faz o item desaparecer antes de ser visto. Uma falha de imagem libera o ícone de fallback, e Escape continua disponível durante o carregamento. O teste de fluxo retém a primeira imagem por mais tempo que a duração normal do anúncio para verificar esse comportamento.

## Compatibilidade

Os eventos `start` têm campos opcionais de Ki e máximos de HP/Ki. Os eventos de regeneração podem informar `remainingHp`. O contexto mantém `areaId`, incluindo o resultado salvo. Todos são campos JSON adicionais: os logs e combates ativos antigos continuam compatíveis, sem migration de banco. Logs antigos usam os recursos disponíveis como fallback; lutas novas preservam os máximos originais mesmo após subir de nível.

## Artes

A Floresta utiliza a imagem enviada pelo usuário em `public/images/image.png`, preservada no projeto. Sua versão otimizada fica em `public/images/arenas/floresta.webp`. Montanhas, Deserto, Red Ribbon e o palácio de Piccolo Daimao receberam cenários próprios.

As cinco raças usam sprites de jogo gerados para esta arena, com guarda, golpe físico, Ki e chute: quatro quadros de 208 × 200 por folha, total 832 × 200. Os seis inimigos têm três poses de 160 × 200, total 480 × 200. O tamanho dos representantes varia por raça/inimigo; jogador e adversário olham um para o outro.

Os WebP ficam em `public/images/battle-sprites`, com transparência real. Os sprites são servidos sem redimensionamento automático do Next, com `image-rendering: pixelated`, para preservar os quadros e os pixels. As poses foram extraídas por componentes de alfa, evitando cortar mãos, armas e caudas que ultrapassassem divisões arbitrárias de um atlas. A preparação usou recorte, escala nearest-neighbor e composição das células; não redesenhou imagens por código.

As artes foram geradas com **imagegen integrado**, sem CLI. O conjunto completo de prompts está em [battle-art-prompts.json](battle-art-prompts.json). As versões finais foram inspecionadas com fundo de contraste e dentro da arena; as imagens originais geradas permanecem no diretório de imagens do Codex.

O recorte de Pilaf em `public/images/classic/pilaf-v2.webp` e os 32 ícones em `public/images/classic-items/*-v2.webp` foram corrigidos individualmente com **imagegen integrado**, preservando os itens e removendo fragmentos de imagens vizinhas. Cada ícone tem transparência real, enquadramento central e margem de segurança. A conversão para WebP conserva o alfa; os caminhos versionados evitam reutilizar imagens antigas no cache. Pilaf usa a proporção real do retrato também no sprite de combate. Os prompts estão em [art-cleanup-prompts.json](art-cleanup-prompts.json).

As cinco artes originais usadas de poções, armaduras e Sementes dos Deuses foram centralizadas com a mesma margem em `public/images/items/*-v2.webp`, sem redesenho. Os 37 ícones finais foram conferidos em composição de revisão, verificando bordas transparentes, centro do recorte e enquadramento seguro.

Os 23 retratos de combatentes clássicos usam versões `classic/*-v2.webp` de 384 × 512, com corpo inteiro e margem transparente. Kame reaproveita o original completo; 14 figuras com partes ausentes ou fragmentos vizinhos foram reparadas com **imagegen integrado**. As instruções estão em [fighter-art-repair-prompts.json](fighter-art-repair-prompts.json). Os mesmos cenários clássicos receberam apenas remoção de margens transparentes, sem redesenho ou substituição do conteúdo.

## Verificação

O inventário, a lista de recompensas e a revelação de drops usam `item-presentation.ts` para exibir épicos, raros, incomuns e comuns nessa ordem. Itens da mesma raridade mantêm a ordem original. A ordenação trabalha sobre uma cópia, sem alterar recompensas, quantidades ou o estado persistido.

`tests/battle-presentation.test.ts` verifica projeção de dano e Ki, regeneração, máximos originais, fase, resultado, compatibilidade com logs antigos e metadados emitidos pelo motor. `tests/e2e/battle-arena.spec.ts` verifica o combate real em conta descartável, carregamento e enquadramento, poses de chute/Ki, troca de modo, replay sem mutações e movimento reduzido. As imagens de revisão ficam em `.local/screenshots`, sem entrar no Git.

`battle-flow.spec.ts` verifica o seletor, busca, áreas bloqueadas, chegada à arena, quatro raridades, enquadramento mobile, log integrado, Escape e replay de drops sem mutar inventário. As quatro raridades usam respostas visuais fixas exclusivas do teste, enquanto a batalha real e seus drops persistidos continuam calculados pelo servidor. `battle-scroll.spec.ts` verifica separadamente o início com rolagem à arena e a conclusão sem mudança de posição. A fixture comum `browser-test.ts` aguarda o limite real de cadastro quando várias contas descartáveis compartilham o mesmo IP; não desativa limites nem apaga os contadores de autenticação.

O teste de fluxo também confere o centro do item em relação ao círculo. O teste de rolagem cobre **Batalhar** e **Explorar**, com início manual, conclusão, combate automático e repetição da exploração sem voltar ao menu. `classic-content.spec.ts` verifica o carregamento dos ícones do inventário e o retrato corrigido de Pilaf em uma batalha real, com revisão em 320, 390 e 1440 pixels.

`turn-menu.spec.ts` verifica comandos, poção consumida uma única vez, recarga, defesa, foco, avatares, bloqueio de navegação no desktop/celular, velocidade após reload, primeira vitória e farm automático de boss. Formações com dois/três/cinco combatentes por lado e os 23 retratos usam fixtures exclusivamente visuais, sem alterar o motor nem o progresso. Os testes transacionais e de preferências conferem o desbloqueio pelo ID exato e a compatibilidade dos estados antigos.
