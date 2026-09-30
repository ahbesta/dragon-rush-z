# Artes do portal

O portal usa arquivos WebP locais em `public/images`, sem carregar imagens de servidores externos durante o jogo. O catálogo `src/lib/game-art.ts` associa IDs a imagens e textos alternativos; estatísticas, requisitos e recompensas continuam no banco e no servidor. Itens e transformações sem imagem cadastrada usam ícones. `ArtworkImage` também oferece fallback se uma imagem não carregar.

## Arquivos e origem

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
