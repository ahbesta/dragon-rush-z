# Arte do portal

O menu usa uma ilustração original gerada com a ferramenta integrada `imagegen`, convertida para WebP e salva em `public/images/dragon-ball-menu.webp`. A imagem é carregada do próprio projeto, sem depender de um serviço de imagens externo. Goku, Bulma, Vegeta e Piccolo ilustram os destinos; os cards não concedem acesso a mestres ou técnicas.

A composição foi pensada em quatro colunas. O CSS seleciona a coluna de cada personagem para os cards e para a abertura. Títulos, recompensas, navegação e botões são HTML; nenhum controle faz parte da imagem.

## Prompt usado

```text
Use case: stylized-concept. Asset type: four-character art atlas for menu cards in a Dragon Ball fan browser RPG, NOT a UI mockup. Wide landscape image 2:1 ratio. EXACTLY FOUR equally wide vertical illustration panels side by side, each occupies 25 percent of total image width, no borders or labels. EACH portrait fills its own column, head fully contained in top half, shoulders and torso visible, lower 25 percent naturally dark navy for HTML title overlay. Panel 1 LEFT: adult Goku black spiky hair orange gi blue undershirt, powering up with clenched fists, intense amber sparks, rocky training ground. Panel 2: Bulma blue hair, white and pink adventure clothes, friendly confident explorer holding a Dragon Radar device in her hand, behind her Capsule Corp aircraft and green mountains, turquoise blue light. Panel 3: Vegeta black tall spiky hair, classic white Saiyan armor over blue bodysuit, battle ready fist and stern look, deep blue energy aura and orange diagonal speed lines. Panel 4 RIGHT: Piccolo green skin, antennae, purple gi and white flowing cape, orange sunset purple rocky sky, fingertips gathering a small blue energy orb. Highly polished expressive cel-shaded Japanese anime illustration, clear bold contours, strong facial detail, canonical recognizable Dragon Ball characters. Color grade deep midnight navy, electric blue, amber orange. All four columns use matching visual finish and character scale. No letters, words, logos, numbers, text, panels of game UI, watermarks. No characters crossing between their columns. Background must be entirely opaque.
```

## Interface

`src/components/game-lobby.tsx` apresenta as ações e o resumo do jogador. `src/app/game-theme.css` centraliza o tema do portal, incluindo login, seleção de raça e telas de jogo. As regras e recompensas continuam no servidor.

A referência visual foi a tela inicial de https://brasileirinhofc.com/: menu horizontal, abertura expressiva e destinos ilustrados. Nenhuma imagem, marca ou código do site foi copiado.
