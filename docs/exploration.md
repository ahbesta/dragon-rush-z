# Exploração da Terra

Cada saída abre uma expedição persistida com até cinco trechos. Cada trecho sorteia uma ocorrência com até duas escolhas em sequência. Terminar uma ocorrência abre a decisão de voltar em segurança ou avançar; não encerra a expedição automaticamente. Batalhar continua oferecendo seleção direta de adversários. Explorar oferece materiais, NPCs, perigos, tesouros, caminhos e ocorrências excepcionais.

## Conteúdo e equilíbrio

São 96 definições nas 16 áreas, 16 caminhos permanentes, 16 mapas, 16 insígnias e um kit reutilizável. Os mapas e o kit são fabricados nas vilas usando materiais existentes. A ajuda ao contato regional desbloqueia sua receita; o diário acompanha os registros.

Na trilha principal: coleta 35%, NPC 20%, perigo 15%, tesouro 25%, descoberta 4,5%, excepcional 0,5%. Caminhos favorecem coleta/tesouro redistribuindo apenas os 95% comuns. Frequências raras permanecem iguais. Uma ocorrência rara exige uma escolha bem-sucedida: não garante equipamento. Não há pity.

Chance de teste = `clamp(10, 90, round(50 + (atributo - alvo)/(2*alvo)*100 + bônus))`. Usa atributos efetivos; afinidades raciais já foram aplicadas. Ferramentas aplicam apenas o maior bônus compatível, nunca multiplicam pela quantidade. Mapas dão +10 pontos percentuais na sua região; insígnias equipadas dão +8.

Coleta segura entrega um material e zero XP. Arriscar entrega mais dois se der certo. Tesouros podem dar 4–8 Zeni além do material inicial. NPCs dão 10 XP uma vez; caminhos, 20 XP uma vez. Insígnias são únicas por região. Recompensas de emboscadas também ficam pendentes na expedição, incluindo XP, Zeni e drops. Concluir a batalha não os deposita: voltar em segurança concede tudo uma única vez. Vitórias continuam contando para missões e para os registros de inimigos derrotados. Batalhar diretamente permanece com o depósito imediato existente.

Achados permanecem pendentes até concluir. Falha/abandono descarta apenas esses achados. Custos pagos não voltam. Perigos ambientais causam 40% do HP máximo, ou 60% em cápsulas excepcionais; podem matar. Emboscadas usam o motor de combate existente. A emboscada é apresentada antes de abrir a arena, com adversário, HP, motivo e consequências; `exploration.fight` confirma o confronto. Vitória abre a decisão de retorno/avanço e conserva os achados pendentes. Derrota/empate perde os achados de todos os trechos. Durante a emboscada não é possível retornar ou abandonar sem enfrentar o inimigo. Poções podem ser usadas no encontro; durante combate vale o sistema de cinturão.

## Persistência e segurança

`exploration_events` e `exploration_routes` são catálogos administrativos. `exploration_sessions` guarda a definição congelada, os sorteios privados, a revisão, o estágio, os custos/achados e a associação ao combate. Um índice parcial permite apenas um encontro pendente por personagem. O lock transacional do personagem e os recibos de idempotência protegem todas as ações e recompensas. O cooldown de 12 segundos usa o relógio do banco, desde o início de cada saída.

Avançar custa `2 × trecho atual` Ki. A dificuldade dos testes aumenta 35% por trecho desde a partida; o custo de Ki das escolhas aumenta 25%; o dano ambiental aumenta 8 pontos percentuais, limitado a 90% do HP máximo. Inimigos recebem +25% HP e +18% atributos por trecho; XP/Zeni de combate aumentam 20%. Materiais comuns crescem em uma unidade a cada dois avanços; Zeni de tesouros crescem 25% por trecho. Relíquias e XP de descobertas não multiplicam. A frequência de perigos aumenta 10 pontos percentuais por trecho (limite 60%), reduzindo proporcionalmente coleta/NPC/tesouro; descoberta 4,5% e excepcional 0,5% continuam fixos, incluindo rotas alternativas. O quinto trecho bloqueia avanço e permite retorno. O cooldown de combate também vale para avançar depois de uma luta.

O cliente envia apenas `areaId`/`routeId` para iniciar, e `encounterId`, `revision`, `choiceId` para escolher. Abandono exige ID e revisão. Avanço, retorno e confirmação da emboscada exigem ID e revisão. Não recebe o catálogo privado, sorteios ou etapas futuras. A projeção pública expõe apenas os ganhos possíveis (intervalos configurados), a chance de sucesso e as consequências da escolha atual, sem revelar qual resultado foi sorteado. Descobertas pendentes já bloqueiam repetições na mesma expedição. Escolhas inválidas, revisões antigas, rotas não descobertas e tentativas de agir no encontro de outra conta são rejeitadas.

O catálogo privado de encontros é carregado somente para iniciar ou avançar uma exploração; escolhas usam a definição persistida. Consultas e combates não transferem esses dados do banco. O cooldown de combate mantém a duração configurada e começa ao finalizar a transação de recompensas, evitando que consultas lentas consumam a espera antes da resposta.

Durante um encontro, páginas de consulta e poções continuam disponíveis; novas atividades, compras, fabricação, equipamento e novos combates exigem resolução/abandono. Emboscadas mantêm o bloqueio de navegação existente. Recarregar não sorteia novamente.

## Instalação incremental

1. `npm run db:migrate` aplica as tabelas novas.
2. `npx tsx scripts/seed-exploration.ts` instala somente este conteúdo. Não altera personagens, drops, balanceamento ou catálogos anteriores. O seed completo também inclui este conteúdo para bancos novos.

Encontros existentes mantêm sua definição congelada quando o catálogo é atualizado. Novas definições devem usar IDs existentes de áreas, itens e inimigos comuns da região, custos positivos e destinos de estágio válidos. Os testes verificam referências e integridade do catálogo.

Artes geradas pelo modo integrado de `image_gen` estão em `public/images/exploration`; os prompts estão em `prompts.json`. NPCs e itens foram inspecionados antes da integração. Sprites e cenários de combate existentes permanecem iguais. Escolhas usam comandos de RPG com arte do achado, custos e perigo; ações seguras não repetem blocos de “garantido”, “grátis” e “sem risco”. Ganhos mantêm a animação de itens com aviso de achado pendente. Perdas têm popup destacado e resumo persistido com HP, Ki, materiais, XP e Zeni descartados. Campos adicionais são persistidos no JSON da sessão; sessões antigas assumem trecho 1 e preservam os sorteios e achados existentes.
