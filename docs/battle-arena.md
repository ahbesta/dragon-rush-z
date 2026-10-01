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

## Compatibilidade

Os eventos `start` têm campos opcionais de Ki e máximos de HP/Ki. Os eventos de regeneração podem informar `remainingHp`. O contexto mantém `areaId`, incluindo o resultado salvo. Todos são campos JSON adicionais: os logs e combates ativos antigos continuam compatíveis, sem migration de banco. Logs antigos usam os recursos disponíveis como fallback; lutas novas preservam os máximos originais mesmo após subir de nível.

## Artes

A Floresta utiliza a imagem enviada pelo usuário em `public/images/image.png`, preservada no projeto. Sua versão otimizada fica em `public/images/arenas/floresta.webp`. Montanhas, Deserto, Red Ribbon e o palácio de Piccolo Daimao receberam cenários próprios.

As cinco raças usam sprites de jogo gerados para esta arena, com guarda, golpe físico, Ki e chute: quatro quadros de 208 × 200 por folha, total 832 × 200. Os seis inimigos têm três poses de 160 × 200, total 480 × 200. O tamanho dos representantes varia por raça/inimigo; jogador e adversário olham um para o outro.

Os WebP ficam em `public/images/battle-sprites`, com transparência real. Os sprites são servidos sem redimensionamento automático do Next, com `image-rendering: pixelated`, para preservar os quadros e os pixels. As poses foram extraídas por componentes de alfa, evitando cortar mãos, armas e caudas que ultrapassassem divisões arbitrárias de um atlas. A preparação usou recorte, escala nearest-neighbor e composição das células; não redesenhou imagens por código.

As artes foram geradas com **imagegen integrado**, sem CLI. O conjunto completo de prompts está em [battle-art-prompts.json](battle-art-prompts.json). As versões finais foram inspecionadas com fundo de contraste e dentro da arena; as imagens originais geradas permanecem no diretório de imagens do Codex.

## Verificação

`tests/battle-presentation.test.ts` verifica projeção de dano e Ki, regeneração, máximos originais, fase, resultado, compatibilidade com logs antigos e metadados emitidos pelo motor. `tests/e2e/battle-arena.spec.ts` verifica o combate real em conta descartável, carregamento e enquadramento, poses de chute/Ki, troca de modo, replay sem mutações e movimento reduzido. As imagens de revisão ficam em `.local/screenshots`, sem entrar no Git.
