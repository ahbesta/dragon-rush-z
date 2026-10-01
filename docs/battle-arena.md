# Arena de combate

O combate continua sendo resolvido e salvo pelo servidor. A arena reproduz os eventos recebidos em cenários 2D, com sprites, golpes físicos, carga e disparo de Ki, impactos, dano, mudança de fase do boss e resultado. O modo manual permite escolher a próxima técnica; o automático reproduz a luta já calculada. Trocar de modo mantém a mesma batalha.

## Organização

- `src/game/combat.ts`: motor autoritativo, eventos e recursos iniciais da luta.
- `src/lib/battle-presentation.ts`: converte ataque/dano em quadros visuais. Usa `remainingHp`/`remainingKi` recebidos; não calcula dano, drops ou recompensas.
- `src/components/use-battle-playback.ts`: fila de quadros novos, velocidade, replay e cancelamento de timers. Uma luta manual retomada mostra o estado salvo sem repetir rodadas anteriores.
- `src/components/battle-arena.tsx`: cenário, dois lutadores, HUD, efeitos e controles. As técnicas continuam validadas no servidor.
- `src/app/battle-arena.css`: movimentos e efeitos responsivos, respeitando `prefers-reduced-motion`.
- `src/lib/game-art.ts`: associação entre IDs, cenários e folhas de sprites. Não contém atributos de jogo.

As opções 1x/2x, pular e rever alteram somente a apresentação. Elas não enviam ações de jogo, aceleram cooldowns ou repetem recompensas. Enquanto uma rodada manual está sendo animada, os botões de técnica aguardam o fim da reprodução; é possível pular a animação ou trocar de modo.

## Escolha de área e chegada à arena

`battle-destinations.tsx` mostra a área selecionada e seus adversários. O botão **Trocar área** abre um diálogo nativo, com busca, filtro de disponíveis e acesso às áreas bloqueadas para consultar requisitos. Escape fecha o diálogo e devolve o foco ao botão. Exploração permite encontrar um inimigo aleatório ou escolher um diretamente. Os bosses continuam nas próprias áreas; o atalho de Piccolo na tela inicial seleciona o Castelo do Rei.

Quando o servidor confirma o início de uma nova luta, a página leva o foco e a rolagem à arena. Isso ocorre uma vez por ID de batalha, somente em ações de início: `battle`, `boss` e `explore`. Turnos, poções, conclusão e mudanças de modo não deslocam a página. Ao substituir os comandos por um resultado menor, a altura mínima da página preserva a posição do viewport; navegação explícita e uma nova luta liberam essa reserva. Uma luta retomada seleciona a área registrada no combate.

## Log e drops

O histórico manual fica aberto dentro da arena. A rolagem automática acompanha o final do log dentro de seu próprio painel; consultar eventos anteriores pausa esse acompanhamento. Resultado, XP, Zeni e drops permanecem na mesma arena ao concluir, sem um segundo painel de batalha separado das escolhas de área.

`battle-loot-reveal.tsx` apresenta cada drop confirmado pelo servidor no centro do cenário, após a reprodução terminar ou ser pulada. Itens comuns têm luz suave; incomuns usam verde e partículas; raros usam azul e ondas de energia; épicos usam violeta, brilho e partículas mais intensas. Mostra arte, quantidade, nome e raridade do catálogo, com avanço automático ou manual e opção de fechar por Escape. **Ver drops** repete só a apresentação; não envia requisições nem concede itens novamente. Movimento reduzido conserva as informações sem animações. Recarregar uma luta antiga não repete o anúncio automaticamente.

## Compatibilidade

Os eventos `start` têm campos opcionais de Ki e máximos de HP/Ki. Os eventos de regeneração podem informar `remainingHp`. O contexto mantém `areaId`, incluindo o resultado salvo. Todos são campos JSON adicionais: os logs e combates ativos antigos continuam compatíveis, sem migration de banco. Logs antigos usam os recursos disponíveis como fallback; lutas novas preservam os máximos originais mesmo após subir de nível.

## Artes

A Floresta utiliza a imagem enviada pelo usuário em `public/images/image.png`, preservada no projeto. Sua versão otimizada fica em `public/images/arenas/floresta.webp`. Montanhas, Deserto, Red Ribbon e o palácio de Piccolo Daimao receberam cenários próprios.

As cinco raças usam sprites de jogo gerados para esta arena, com guarda, golpe físico, Ki e chute: quatro quadros de 208 × 200 por folha, total 832 × 200. Os seis inimigos têm três poses de 160 × 200, total 480 × 200. O tamanho dos representantes varia por raça/inimigo; jogador e adversário olham um para o outro.

Os WebP ficam em `public/images/battle-sprites`, com transparência real. Os sprites são servidos sem redimensionamento automático do Next, com `image-rendering: pixelated`, para preservar os quadros e os pixels. As poses foram extraídas por componentes de alfa, evitando cortar mãos, armas e caudas que ultrapassassem divisões arbitrárias de um atlas. A preparação usou recorte, escala nearest-neighbor e composição das células; não redesenhou imagens por código.

As artes foram geradas com **imagegen integrado**, sem CLI. O conjunto completo de prompts está em [battle-art-prompts.json](battle-art-prompts.json). As versões finais foram inspecionadas com fundo de contraste e dentro da arena; as imagens originais geradas permanecem no diretório de imagens do Codex.

## Verificação

`tests/battle-presentation.test.ts` verifica projeção de dano e Ki, regeneração, máximos originais, fase, resultado, compatibilidade com logs antigos e metadados emitidos pelo motor. `tests/e2e/battle-arena.spec.ts` verifica o combate real em conta descartável, carregamento e enquadramento, poses de chute/Ki, troca de modo, replay sem mutações e movimento reduzido. As imagens de revisão ficam em `.local/screenshots`, sem entrar no Git.

`battle-flow.spec.ts` verifica o seletor, busca, áreas bloqueadas, chegada à arena, quatro raridades, enquadramento mobile, log integrado, Escape e replay de drops sem mutar inventário. As quatro raridades usam respostas visuais fixas exclusivas do teste, enquanto a batalha real e seus drops persistidos continuam calculados pelo servidor. `battle-scroll.spec.ts` verifica separadamente o início com rolagem à arena e a conclusão sem mudança de posição. A fixture comum `browser-test.ts` aguarda o limite real de cadastro quando várias contas descartáveis compartilham o mesmo IP; não desativa limites nem apaga os contadores de autenticação.
