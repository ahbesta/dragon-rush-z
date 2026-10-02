# Interface de RPG

Os títulos principais das seções, perfil e criação usam a mesma Saiyan Sans do mapa, com amarelo/laranja e contorno escuro. `public/fonts/saiyan-sans-pt.ttf` preserva os desenhos e larguras da fonte original de Ben Palmer, adicionando acentos latinos; a atribuição original está em `public/fonts/saiyan-sans-readme.txt`. Textos corridos, números e controles mantêm suas fontes de leitura.

`src/app/rpg-interface.css` aplica a linguagem compartilhada de console depois dos estilos de cada seção. A moldura envolve a janela de comandos, ficha ou lista; atributos, escolhas e itens não recebem cards independentes. Azul escuro, laranja de seleção e dourado identificam as janelas. Cursores respondem tanto ao mouse quanto ao foco de teclado.

Exploração apresenta local/trecho, evento com artwork, escolhas, consequência e próximo passo. Esferas do Dragão marcam os cinco trechos. Indicadores curtos avisam perigo/recompensa crescentes; valores completos ficam em detalhes. A bolsa pode ser aberta durante o evento e aparece diretamente na decisão de retorno. Emboscadas mostram o adversário antes da confirmação. Durante o combate a janela do evento cede espaço à arena; Continuar abre a decisão de retornar ou avançar.

Resultados de combate destacam vitória/derrota, personagens, XP, Zeni e itens; o histórico começa recolhido. Continuar encerra a apresentação e volta à seleção de adversários ou ao próximo passo da exploração. Não altera recompensas, turnos, sprites ou cenários. Detalhes de equipamentos e técnicas permanecem acessíveis nas listas, sem dominar a apresentação.

O fechamento de uma apresentação limpa o identificador visual no shell. Voltar à seção não reabre o popup de perdas ou a animação de itens; o resultado persistido continua disponível. Recarga não inicia animações antigas. Preferências e estados de apresentação nunca concedem recompensas: ações, custos, propriedade, sorteios e cooldowns continuam validados no servidor.
