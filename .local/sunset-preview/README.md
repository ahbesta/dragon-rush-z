# Pôr do sol no Monte Paozu — prévia local

Abra `index.html` no navegador. O HTML contém todo o CSS e JavaScript, funciona sem internet e inclui os dois sprites de IA como PNGs embutidos. Não faz requisições externas.

Para servir a prévia pelo computador, na raiz do projeto:

```powershell
node .local/sunset-preview/serve.mjs
```

Depois abra http://127.0.0.1:4174.

O desenho usa uma tela nativa de 240 × 160 pixels, coordenadas inteiras, contornos sem suavização e tiles. Apenas Goku e Chi-Chi foram substituídos por sprites gerados com o `image_gen.imagegen` integrado, a partir de referências visuais dos próprios personagens de **Dragon Ball Z: Buu's Fury**. Goku tem quatro quadros para cada uma das quatro direções; Chi-Chi tem quatro quadros mexendo uma colher. O cenário aprovado, a arquitetura, os objetos e os demais movimentos foram preservados.

Arquivos finais:

- `ai-sprites/goku-atlas.png`: atlas transparente de Goku, 128 × 132 pixels.
- `ai-sprites/chichi-atlas.png`: atlas transparente de Chi-Chi, 68 × 88 pixels.
- `ai-sprites/goku-generated.png` e `ai-sprites/chichi-generated.png`: resultados originais da IA, com transparência preservada.
- `ai-sprites/prompts.json`: os dois prompts completos, referências e ferramenta utilizada.
- `ai-sprites/character-change.json`: hashes que comprovam a preservação do HTML e CSS.
- `ai-sprites/preservation-report.json`: comparação dos pixels fora dos personagens em dez instantes da animação.

O tamanho, a posição dos pés e a transparência foram preparados para a cena com recortes e redução por vizinho mais próximo. `before-ai/` guarda a versão aprovada antes da troca dos personagens.

Referências consultadas:

- [Goku de Buu's Fury](https://www.spriters-resource.com/game_boy_advance/dbzbuusfury/asset/47770/).
- [Screenshot de Buu's Fury](https://www.mobygames.com/game/14873/dragon-ball-z-buus-fury/screenshots/gameboy-advance/264832/).
- [Casa do anime](https://threadreaderapp.com/thread/1127122515694891008.html).

A cena tem nuvens e pássaros passando, água animada, reflexos, a nuvem voadora estacionada e flutuando, fumaça da chaminé, Chi-Chi mexendo a panela e Goku percorrendo um caminho em loop. A volta passa atrás da casa. O ciclo completo dura 48 segundos. A reprodução pausa quando a aba fica oculta e começa pausada para quem prefere movimento reduzido.

`pixel-engine.js` é o arquivo de trabalho. Depois de editá-lo, execute `node .local/sunset-preview/sync-pixel.mjs` para atualizar o HTML autossuficiente. `verify.mjs` verifica o enquadramento, os controles, o modo offline, a repetição dos pixels e dois loops reais. O resultado fica em `verification.json`.

Esta pasta tem uma exceção específica no `.gitignore` para preservar a animação, os sprites e os arquivos de edição no repositório. Os demais arquivos de `.local/`, incluindo o banco local, continuam ignorados. A prévia não foi integrada às telas do jogo. A versão anterior em perspectiva de blocos está em `index-voxel.html`, para histórico; a versão atual é `index.html`.
