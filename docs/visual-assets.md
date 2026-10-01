# Artes do portal

O portal usa arquivos WebP locais em `public/images`, sem carregar imagens de servidores externos durante o jogo. O catálogo `src/lib/game-art.ts` associa IDs a imagens e textos alternativos; estatísticas, requisitos e recompensas continuam no banco e no servidor. Itens e transformações sem imagem cadastrada usam ícones. `ArtworkImage` também oferece fallback se uma imagem não carregar.

## Arquivos e origem

- `activities/{treino-kame,descanso-kame}.webp`: atlas de seis quadros por cena, gerados com imagegen integrado para o treinamento clássico do Mestre Kame e o descanso da turma na banheira da Kame House. Reprodução, condições de visibilidade e prompts estão em [activity-animations.md](activity-animations.md).
- `dragon-ball-menu.webp`: atlas original de Goku, Bulma, Vegeta e Piccolo, gerado com a ferramenta integrada **imagegen** (modo integrado, sem CLI).
- `characters/{goku,bulma,vegeta,piccolo}.webp`: retratos extraídos do atlas, usados individualmente no login para não mostrar pedaços do personagem vizinho.
- `world/terra-shenron.webp`: cenário de Shenron, Kame House, Terra e a esfera de quatro estrelas, criado e revisado com imagegen integrado.
- `items/{bastao,pocao-hp,pocao-ki,semente-deuses,armadura-simples,armadura-saiyajin}.webp`: seis imagens geradas com imagegen integrado, separadas do atlas e exportadas com transparência. O Bastão representa o Nyoibo de Goku.
- `transformations/super-saiyajin.webp`: ilustração de Goku Super Saiyajin disponibilizada em [Dragon Ball API](https://dragonball-api.com/transformaciones/goku_ssj.webp), consultada pelo [registro de Goku](https://dragonball-api.com/api/characters/1).
- `transformations/golden-freeza.webp`: ilustração de Golden Freeza disponibilizada em [Dragon Ball API](https://dragonball-api.com/transformaciones/freezer_gold.webp), consultada pelo [registro de Freeza](https://dragonball-api.com/api/characters/5).
- `transformations/oozaru.webp`: ilustração de Oozaru disponibilizada pela [página de NicePNG](https://www.nicepng.com/ourpic/u2q8w7w7u2o0o0y3_dbz-vegeta-oozaru/), baixada do [PNG completo com transparência](https://www.nicepng.com/png/full/38-380561_dbz-vegeta-oozaru.png).

As imagens externas foram salvas no projeto e convertidas para WebP mantendo as proporções e a transparência. A renderização das transformações usa `object-fit: contain` para preservar cabelo, ombreiras e caudas. As três formas permanecem bloqueadas, conforme o catálogo existente.

## Prompts utilizados

### Cenário

```text
Use case: stylized-concept. Asset type: wide panoramic background illustration for a Dragon Ball fan-made browser RPG game menu and login screen. Landscape 2:1 composition. A spectacular canonical Dragon Ball Earth scene: the great emerald-green serpentine dragon Shenron with long sinuous scaled body, four small clawed limbs, antler-like horns, long whiskers and bright red eyes curling majestically through the upper RIGHT sky. The complete head and horns must fit with comfortable margin. Below, a tiny tropical island with the recognizable pink Kame House and red tile roof, turquoise ocean, palm trees, distant towering Dragon Ball style rocky mountain islands. Seven glowing orange Dragon Balls clustered in the LOWER LEFT foreground on a flat rock. Deep midnight blue to electric blue sky, golden sunset light, sparse energy sparks, epic yet inviting atmosphere. Clean cel-shaded anime illustration with strong drawn contours, colorful polished game key-art finish. Large quiet darker regions in the central sky allow HTML navigation text overlay; preserve the recognizable scene around them. NO humanoid characters, no people, no words, no numbers, no logos, no typography, no text on the house, no watermarks, no user interface elements. Opaque background.
```

### Revisão do cenário

```text
Edit this Dragon Ball background illustration. Keep the Kame House, island, sea, mountains, color palette and overall arrangement unchanged. Correct only two details: (1) Shenron's complete antlers and head must be inside the image, with a small clear sky margin above the horn tips; slightly reduce or move his upper body down as needed. (2) The seven orange Dragon Balls in the lower-left foreground must have one through seven RED stars respectively, one ball of each count, no duplicates. Preserve the seven-ball arrangement and render stars sharply and visibly. In order from left to right by the centers of the balls, use 1, 2, 3, 4, 5, 6, 7 stars. Do not add letters or any UI, do not change the aspect ratio, keep a fully opaque background. This is an asset correction for a personal Dragon Ball fan RPG.
```

### Correção final da esfera

A tentativa de representar as sete esferas gerou contagens de estrelas repetidas. A revisão final simplificou o conjunto para a esfera de quatro estrelas, cuja contagem foi conferida visualmente.

```text
Edit this Dragon Ball fan RPG background. Preserve Shenron, the Kame House, the island, the ocean, the mountains, framing, colors and lighting exactly. Change only the lower-left foreground: replace the entire cluster of seven orange Dragon Balls with ONE orange Dragon Ball, centered on that foreground flat rock. This single Dragon Ball must clearly contain EXACTLY FOUR red stars arranged as a simple two-by-two square inside it. Remove all other balls and their reflections. Keep realistic orange glow around this one ball. No text, no logos, no UI. Preserve the fully opaque background and wide aspect ratio.
```

### Itens

```text
Use case: stylized-concept. Asset type: six inventory object illustrations for a Dragon Ball fan browser RPG. Generate a clean 3 columns by 2 rows atlas of EXACTLY SIX separate objects, on genuinely TRANSPARENT background. Each object is fully visible, centered within its own equal sized grid cell with ample transparent margin; objects must never cross cell boundaries. No visible grid, no text, no lettering, no labels. Anime game item art with clean cel shading, crisp outlines, beautiful highlights, accurate shapes. TOP LEFT: Goku's iconic Nyoibo Power Pole, a single long straight cylindrical RED wooden staff placed diagonally bottom-left to top-right, entire staff including both tips visible within the cell, red lacquer texture, no blade, no hilt, no joints. TOP CENTER: a small clear glass health potion bottle holding ruby RED liquid, cork stopper, gentle amber highlights, round bottle with no label. TOP RIGHT: a small clear glass Ki potion bottle holding bright CYAN BLUE liquid, cork stopper, small blue aura, no label. BOTTOM LEFT: an open little beige drawstring cloth pouch with three green Senzu Beans visibly spilling in front, bean shapes recognizable. BOTTOM CENTER: a simple brown padded martial artist protective armor vest, displayed without a wearer, black straps, no weapons. BOTTOM RIGHT: canonical Saiyan combat chest armor displayed without a wearer, white shoulder and chest plates, navy blue torso sides, pale gold segmented abdomen and shoulder strips, no helmet. All six objects should use consistent premium polished anime inventory illustration style. Nothing else, no characters, no hands, no backgrounds, no floor plane, no UI frames, no watermarks. Preserve actual alpha transparency.
```

## Verificação visual

Cada item e transformação foi inspecionado antes de entrar na interface. A imagem de Oozaru usa o PNG completo: a prévia do fornecedor continha fundo branco. Os limites de extração do atlas de itens preservam as pontas do Bastão e as ombreiras da armadura Saiyajin.

Login, hero, inventário e transformações são verificados no navegador em larguras de 320, 390, 768, 1024 e 1440 pixels; o teste `tests/e2e/artwork.spec.ts` também confere carregamento, ausência de rolagem horizontal, legendas sem sobreposição e preservação de XP, Zeni e Power Level durante a navegação. Os registros ficam em `.local/screenshots` e não são commitados.

O tema está em `src/app/game-theme.css`, e os enquadramentos das artes em `src/app/artwork.css`. Nomes, navegação, recompensas e botões permanecem HTML.

A referência anterior foi a abertura de [Brasileirinho FC](https://brasileirinhofc.com/): menu horizontal e destinos ilustrados. Nenhuma imagem, marca ou código desse site foi copiado.

## Revisão das atividades e adversários

Shenlong aparece exclusivamente no fundo de `.game-header`, incluindo o menu aberto no celular. O fundo geral, a abertura e o login usam superfícies azuis ou montanhas. As legendas VEGETA/GOKU/PICCOLO e “SUA JORNADA COMEÇA NA TERRA” foram removidas.

Os quatro atalhos usam cenas da própria atividade. As mesmas cenas ilustram treinamento e descanso; as quatro áreas têm imagens diferentes. Inimigos são apresentados nas listas, o boss aparece no personagem e na arena, e o resultado mostra o adversário enfrentado. Todas as seis técnicas e as cinco raças possuem arte. Nenhuma imagem altera atributos, desbloqueios ou recompensas.

### Novos arquivos

- `public/images/scenes/{floresta,montanhas,deserto,red-ribbon,treinamento,combate,ki,descanso}.webp`: oito cenas geradas com **imagegen integrado**, exportadas do atlas por célula.
- `public/images/techniques/{soco,chute-v2,rajada-ki,kamehameha,masenko,galick-gun}.webp`: seis artes geradas com imagegen integrado. Ki azul, Masenko amarelo e Galick Gun violeta se distinguem visualmente.
- `public/images/enemies/{lobo,bandido,dinossauro,soldado-red-ribbon}.webp`: imagens individuais geradas com imagegen integrado, preservando transparência e corpo inteiro.
- `public/images/enemies/saibaman.webp`: extraído do atlas gerado e revisado com imagegen integrado. Recorte inspecionado para não conter partes de outro adversário.
- `public/images/enemies/piccolo-daimao.webp`: arte existente de Piccolo Daimao por BardockSonic, disponibilizada nesta [página do NicePNG](https://www.nicepng.com/ourpic/u2q8i1a9q8i1w7q8_piccolo-daimaoh-by-bardocksonic-on-deviantart-demon-king/) e baixada do [PNG completo](https://www.nicepng.com/png/full/127-1277047_piccolo-daimaoh-by-bardocksonic-on-deviantart-demon-king.png).
- `public/images/races/{saiyajin,humano,namekuseijin,majin,freeza}.webp`: representantes ilustrativos das raças, obtidos do [catálogo Dragon Ball API](https://dragonball-api.com/api/characters?limit=100). Não representam a aparência do personagem criado pelo jogador. Originais: [Goku](https://dragonball-api.com/characters/goku_normal.webp), [Kuririn](https://dragonball-api.com/characters/Krilin_Universo7.webp), [Piccolo](https://dragonball-api.com/characters/picolo_normal.webp), [Majin Buu](https://dragonball-api.com/characters/BuuGordo_Universo7.webp), [Freeza](https://dragonball-api.com/characters/Freezer.webp).

Na inspeção, o atlas inicial de adversários apresentou figuras próximas demais às divisórias. Lobo, bandido, dinossauro e soldado foram refeitos individualmente. Piccolo Daimao usa uma ilustração existente do personagem, e não o retrato de Piccolo dos atalhos anteriores.

### Prompt dos cenários

```text
Use case: stylized-concept. Asset: eight distinct illustrated environments and activities for a Dragon Ball fan browser RPG, NOT a screenshot or UI. Wide 2:1 canvas, exactly FOUR equally wide columns and TWO equally tall rows, eight separate square cells, no drawn grid borders. No scene crosses cell boundaries. All scenes have consistent polished cel shaded Japanese anime game art, thick clear outlines, midnight navy / blue / orange / vibrant green palette. No humanoid characters and no character portraits. TOP ROW left to right: 1 lush wild forest on Dragon Ball Earth, large trees, winding dirt trail, beautiful waterfalls and tall mushroom-shaped rocky cliffs; 2 Dragon Ball rocky mountain range, spectacular tall stone pillars, grassy ridges, blue sky and low clouds; 3 Dragon Ball Earth desert, sand dunes, mesas, amber sunset, subtle dust; 4 Red Ribbon army base in the wilderness, squat gray concrete military fortress, radar dish, gates, watch towers, red banners with NO letters or symbols. BOTTOM ROW left to right: 5 martial arts training ground outdoors, wooden training dummy, heavy ankle and wrist weights, orange folded gi and red wooden staff resting on a rock, mountains in distance; 6 a battle arena, square stone martial arts tournament platform with cracked tiles, dramatic blue and orange energy trails clashing at its center, no fighters, no blood; 7 mastering Ki, one brilliant cyan-blue glowing sphere levitating over a rock surrounded by circular energy waves and golden sparks, a starry navy sky, no people or hands; 8 peaceful recovery refuge, cozy open wooden shelter with a mat and a water jug beside a little green oasis, sunrise glow, calm atmosphere. Each cell fills its own square with a readable central focal point and dark lower quarter for HTML captions. Absolutely no text, letters, numbers, labels, UI, watermarks, Shenron, Dragon Balls or famous humanoid characters. Entirely opaque background.
```

### Prompt das técnicas

```text
Use case: stylized-concept. Asset: six distinct illustrated technique emblems for a Dragon Ball fan browser RPG. Landscape canvas exactly THREE columns by TWO rows, six independent square illustration cells, no borders, no text, no labels, no UI. Highly polished crisp Japanese cel shaded anime illustration on opaque midnight navy backgrounds, brilliant energy and bold outlines. Entire focal object inside its own cell with generous margin. TOP ROW from left: 1 SOCO represented by ONE clenched human fist and short forearm in an orange gi sleeve, fist in side view, anatomically correct one thumb folded over four curled fingers, forward orange motion streaks; 2 CHUTE represented by ONE blue martial artist boot with a red accent attached to a short orange trouser leg, dynamic sideways kick, no other limbs or figures; 3 RAJADA DE KI represented by three small separate cyan energy projectiles flying diagonally across a rocky navy backdrop. BOTTOM ROW from left: 4 KAMEHAMEHA represented by one enormous cyan blue spherical energy wave with bright white core and a tapering blue beam trail, turbulent blue rings; 5 MASENKO represented by one yellow-gold concentrated energy blast with bright white core, angular golden lightning and a luminous yellow trail; 6 GALICK GUN represented by one deep violet magenta spherical energy blast with white core and a tapered purple beam trail, violet lightning. No complete humanoid characters, no faces, no famous character portraits, no other hands or limbs, no letters, numbers, typography, logos, watermark. Keep six cells distinct and the effects visually different by their color, shape and composition.
```

### Atlas de adversários e sua revisão

```text
Use case: stylized-concept. Asset: six isolated full body adversary illustrations for a personal Dragon Ball fan browser RPG. Exactly THREE columns and TWO rows on a truly TRANSPARENT background. Six separate equal-sized cells, each illustration fully visible with ample margin including all heads, ears, tails, hands, feet and weapons. No object or character crosses a cell boundary. Polished cel shaded anime Dragon Ball visual style, clean bold outlines, accurate anatomy, crisp shading. TOP ROW left to right: 1 a fierce gray wild wolf, four legs, pointed ears, bushy tail, alert crouched side view, no accessories; 2 an anonymous rugged Dragon Ball Earth bandit wearing a dark headband and brown scavenger outfit, holding a single short curved sword at his side, two arms and two legs; 3 an iconic Dragon Ball style green Tyrannosaurus dinosaur with a large head, two tiny forearms, two strong hind legs and a long visible tail, side view. BOTTOM ROW left to right: 4 canonical Saibaman, small green humanoid alien plant creature with segmented large green head, pointed ears, red eyes, hunched muscular body and claws, full body combat stance; 5 anonymous Red Ribbon Army infantry soldier in dark gray green military uniform, red shoulder patch without letters, peaked cap, combat boots, holding one rifle pointing downward in non-firing stance, full body; 6 canonical Piccolo Daimao, the original Dragon Ball Demon King, tall green Namekian, pointed ears, two antennae, stern wrinkled face, dark navy blue sleeveless tunic with orange belt, orange boots, open green muscular arms with pink patches, no turban and no white cape, dominant full body pose. NO blood, injury, gore, muzzle flash, text, writing, symbols, logos, names, UI, watermarks, ground plane or backgrounds. Preserve genuine alpha transparency.

Correct this six-adversary atlas for a Dragon Ball fan RPG. Preserve the exact six subjects, poses, colors and anime style. Keep a STRICT three-column, two-row grid with one separate full-body illustration centered in each equal cell. Shrink each illustration slightly so its COMPLETE body has at least 25 pixels of transparent margin on ALL sides of its own cell. In particular, the wolf's entire bushy tail must stay inside the TOP LEFT cell and must not enter the bandit's cell; the dinosaur head and tail must not touch an edge; Piccolo Daimao's complete boots must stay inside the BOTTOM RIGHT cell. Keep the bandit's sword entirely inside his cell. Remove ALL background gradients, gray fill, halos and backdrop color: use genuinely transparent alpha behind each complete character, with clean outlines. Six independent isolated full bodies only, no new figures, no letters, no UI, no borders, no shadows on a ground plane. Preserve the 3:2 canvas aspect ratio.
```

### Adversários individuais

#### lobo

```text
Use case: stylized-concept. Single game adversary illustration for a Dragon Ball browser fan RPG. Exactly ONE complete full body subject centered on genuine transparent alpha. Square image. Entire head, feet, tail, weapon must fit with a wide 15 percent clear transparent margin on every side. Polished cel shaded anime, crisp bold outlines and clean shading, no scenery, no text, no logo, no UI, no watermarks, no ground shadow, no backdrop glow. A fierce gray wild wolf, exactly four legs, pointed ears and a big bushy tail, crouched side view, no clothing, no accessories. Whole tail curls upward inside the image with generous padding, do not crop the paws or nose.
```

#### bandido

```text
Use case: stylized-concept. Single game adversary illustration for a Dragon Ball browser fan RPG. Exactly ONE complete full body subject centered on genuine transparent alpha. Square image. Entire head, feet, tail, weapon must fit with a wide 15 percent clear transparent margin on every side. Polished cel shaded anime, crisp bold outlines and clean shading, no scenery, no text, no logo, no UI, no watermarks, no ground shadow, no backdrop glow. An anonymous Dragon Ball Earth bandit in brown scavenger clothes, maroon headband and dark boots, holding one short curved sword pointed downward at his side. Rugged confident expression, normal human anatomy, no firearms.
```

#### dinossauro

```text
Use case: stylized-concept. Single game adversary illustration for a Dragon Ball browser fan RPG. Exactly ONE complete full body subject centered on genuine transparent alpha. Square image. Entire head, feet, tail, weapon must fit with a wide 15 percent clear transparent margin on every side. Polished cel shaded anime, crisp bold outlines and clean shading, no scenery, no text, no logo, no UI, no watermarks, no ground shadow, no backdrop glow. A green Dragon Ball style Tyrannosaurus dinosaur, large broad head, two tiny forearms, two strong hind legs and a long thick tail curling upward entirely within the image, side view, snarling with teeth, no blood or injury.
```

#### soldado-red-ribbon

```text
Use case: stylized-concept. Single full body Red Ribbon army infantry soldier for a personal Dragon Ball browser RPG. EXACTLY ONE anonymous human soldier centered on genuinely transparent alpha. Square composition with a wide 15 percent clear margin on every side. Polished Dragon Ball cel-shaded anime art, clean bold outlines. Dark gray-green military uniform, red plain shoulder patch, peaked military cap, combat boots, one rifle held pointed downward beside his body in a relaxed non-firing guard stance. Normal human anatomy with exactly two arms, two legs and ordinary hands. Entire cap, boots and rifle inside the image. No other people, no cut-off limbs, no backdrop glow, no gradients, no scenery, no ground shadow, no text, no labels, no logo, no UI, no watermark, no blood.
```

### Verificação

O teste visual cobre carregamento de todas as artes, áreas bloqueadas em modo de visualização, treinamento, descanso, técnicas, inimigos, boss, raças e ausência de rolagem horizontal de 320 a 1440 pixels. Também verifica que somente o cabeçalho usa o fundo de Shenlong, que os três retratos do hero continuam presentes e que as legendas removidas não são renderizadas. A jornada real verifica as ações do jogo e a arte do adversário no resultado do combate.

### Correção anatômica do Chute

A bota na primeira ilustração dava a impressão de estar invertida. A arte foi corrigida com imagegen integrado e salva em `public/images/techniques/chute-v2.webp`: a perna entra pela esquerda, o calcanhar fica abaixo do tornozelo, os dedos apontam para a direita e a sola fica embaixo. O novo nome também evita reutilizar a versão anterior em cache. A primeira versão não faz parte dos arquivos publicados.

```text
Correct the foot anatomy in this Dragon Ball style martial arts kick illustration. Keep the same orange gi trousers, blue boot with red trim, cyan motion streaks, navy rocky background, square composition and cel-shaded anime finish. Replace the reversed-looking boot with an anatomically clear SIDE PROFILE of one foot kicking horizontally to the RIGHT. The leg enters from the LEFT, the ankle is at the LEFT end of the boot, the HEEL is at the LEFT below the ankle, the TOE is at the far RIGHT, and the sole runs along the BOTTOM of the foot. Show the OUTER SIDE of the blue boot, not the bottom sole facing the viewer. The toe extends away from the orange trouser leg and is slightly pointed down in a natural straight-leg kick. No twisted ankle, no backwards foot, no sole on the front of the boot, no extra feet or legs, no detached foot. Keep the entire foot within the image with margin. No faces, letters, text, numbers, logos, watermarks or UI. Fully opaque background. This is a game technique card artwork correction.
```

## Arena em sprites

As batalhas utilizam sprites próprios em pixel art, separados dos retratos em `races`. São cinco representantes com quatro poses e seis inimigos com três poses (38 poses). Os arquivos finais estão em `public/images/battle-sprites`; os cinco cenários ficam em `public/images/arenas`. A Floresta usa a referência do usuário em `public/images/image.png`.

As artes novas foram geradas com **imagegen integrado**, sem CLI, e inspecionadas antes e depois da preparação para jogo. Consulte [os prompts completos](battle-art-prompts.json) e [os detalhes de preparação e reprodução](battle-arena.md).
