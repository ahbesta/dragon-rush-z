# Vida ambiental do mapa

O mapa da Terra possui uma camada decorativa com dois dinossauros de Dragon Ball, uma formação de aves, um pterossauro, Bulma caminhando, Mestre Kame perto da Kame House, dois moradores carregando suprimentos, palmeiras, árvores, folhas ao vento, reflexos e movimento nas cachoeiras. O tom da fauna é o de aventura do Dragon Ball clássico: animais selvagens, proporções robustas e expressões alertas. A primeira proposta infantil foi descartada antes da publicação.

`src/lib/world-map-ambience.ts` organiza sprites, escala, locais e rotas em coordenadas visuais. `WorldMapAmbience` renderiza essa composição abaixo dos marcadores e do avatar. Nenhum ator inicia combate, entrega recompensas ou interfere no personagem. A camada tem `pointer-events: none`, `aria-hidden` e `inert`, para preservar cliques, teclado e leitores de tela. As rotas de terra ficam em clareiras e caminhos junto às construções.

Movimentos de caminhada, direção, asas, folhagem e água usam CSS; não há timers nem chamadas ao servidor para animar. A animação pausa quando a aba fica oculta, o mapa sai do viewport ou um dialog do mapa abre. Ao navegar para outra seção a camada é desmontada e o observer é encerrado. A preferência do sistema por movimento reduzido mostra a composição estática.

## Artes e revisão

As nove folhas WebP finais estão em `public/images/world-map/ambience`: `dino-sauropod`, `dino-predator`, `seabird`, `pterosaur`, `npc-bulma`, `npc-kame`, `npc-merchant`, `palm` e `forest-tree`. Cada arquivo contém quatro quadros e mantém transparência real. Foram geradas com imagegen integrado, em modo de geração e edição; os prompts aprovados estão em [world-map-ambience-prompts.json](world-map-ambience-prompts.json).

A revisão inclui anatomia, expressão, pés, caudas, asas, cajado, transparência, proporções, luz e integração no cenário. O atlas da fauna passou por edição de espaçamento para separar caudas e pontas das asas. A extração detecta as silhuetas completas e rejeita recortes externos e retângulos de sprites que se sobrepõem. Os quadros de solo compartilham escala e linha dos pés; aves são alinhadas pelo bico para evitar saltos verticais ao bater as asas. As imagens finais e quatro fases da animação são inspecionadas no mapa completo e nas vistas de floresta, costa e vila em celular.

`scripts/prepare-map-ambience.mjs` executa somente recorte, alinhamento, escala e codificação das artes aprovadas; não desenha nem remove fundos. Reprodução: `node scripts/prepare-map-ambience.mjs fauna.png moradores.png vegetacao.png`.

## Verificação

`tests/e2e/world-map-ambience.spec.ts` verifica todos os 36 quadros, margens, transparência, carregamento, composição de 320 a 1440 pixels, movimento reduzido, pausa por visibilidade e dialog, ausência de bloqueios de navegação e preservação do estado do personagem e inventário. Capturas locais em `.local/screenshots/map-life` permitem revisar diferentes fases e posições no mapa. O teste existente do mapa verifica caminhada do jogador, raças, seleção de áreas, mercado e atividades reais.
