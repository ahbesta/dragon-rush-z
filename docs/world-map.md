# Mapa interativo da Terra

O mapa substitui o hero e os quatro cartões antigos da página Personagem como entrada visual do jogo. A ficha do personagem, atributos, equipamentos, atividades e menu permanecem disponíveis. Há sete destinos: Treinamento, Descansar, Explorar, Batalhar, Mercado, Inventário e Personagem. Sistemas marcados Em breve continuam no menu, sem destinos que prometam ações ainda indisponíveis.

`src/lib/world-map.ts` contém apenas coordenadas de apresentação, caminhos e associação de sprites por ID de raça. `WorldMap` anima a caminhada com Web Animations e um atlas de quatro quadros por raça, sem alterar atributos nem estado de jogo. Uma nova escolha cancela a caminhada anterior; sair da página cancela a animação. Movimento reduzido leva diretamente ao destino.

Explorar e Batalhar abrem um dialog modal nativo que oferece as áreas do catálogo recebido do servidor. Nível de acesso, nomes, descrições e inimigos vêm do snapshot, sem repetir dados do seed. Selecionar uma área apenas abre a tela correspondente com essa área selecionada; não inicia combate nem concede recompensas. ESC, foco contido no dialog, botão de fechar e clique fora fecham a janela. O mapa funciona pelo teclado e possui atalhos para todos os destinos em telas pequenas.

Mercado abre Técnicas, com preço e requisitos existentes. Comprar usa `technique.learn` no servidor; a navegação do mapa não cria um segundo sistema de compras. Treinamento e Descansar abrem confirmações com a duração e recompensa do catálogo, antes de enviar as ações existentes e abrir a página das atividades. Atividades e batalhas em andamento bloqueiam o início de outra sessão.

## Artes e tipografia

Assets locais: `public/images/world-map/terra.webp` (1536 × 1024) e `public/images/world-map/{saiyajin,humano,namekuseijin,majin,freeza}.webp` (384 × 112, quatro quadros de 96 × 112 por raça). Criados com a ferramenta imagegen integrada, em modo de geração e edição. Os prompts finais e de revisão estão em [world-map-art-prompts.json](world-map-art-prompts.json).

Revisão visual antes da integração: cenário sem palavras geradas, caminhos conectados e edifícios íntegros; corpos, mãos, pés, antenas, caudas e capas completos; ciclos de caminhada com poses diferentes e transparência real. O primeiro atlas tinha recortes na capa do Majin e invasão da linha vizinha por antenas. Foi revisado e o Majin foi regenerado separadamente. As versões com recorte não foram publicadas. A preparação com Sharp apenas recorta por faixas de alfa, normaliza escala e alinhamento dos quadros, preserva transparência e codifica WebP. Uma verificação rejeita sprites encostando nas bordas laterais das células.

Os nomes são texto HTML, sobre a arte, na fonte **Saiyan Sans**, de [Ben Palmer](http://www.tboyonline.com), obtida na [página original do DaFont](https://www.dafont.com/saiyan-sans.font). Arquivo `public/fonts/saiyan-sans.ttf`; o readme original freeware foi preservado em `public/fonts/saiyan-sans-readme.txt`. A fonte tem letras maiúsculas; os marcadores usam palavras sem acentos como Mercado e Mochila, enquanto nomes acessíveis, descrições e telas mantêm a escrita em português. O restante da UI usa suas fontes existentes.

## Verificação

`tests/e2e/world-map.spec.ts` verifica carregamento, fonte, ausência de overflow, marcadores sem sobreposição, sprites das cinco raças, caminhada, redirecionamento durante a caminhada, dialog, teclado, bloqueios por nível, área selecionada, navegação sem POST, compra real com desconto de Zeni, inventário, ficha e início de treinamento/descanso com bloqueio de sessões simultâneas. Os testes anteriores de arte e jornada foram atualizados para a nova entrada pelo mapa.
