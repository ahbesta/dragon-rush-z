# Exploração da Terra

Cada saída abre uma ocorrência persistida, com até duas etapas. Batalhar continua oferecendo seleção direta de adversários. Explorar oferece materiais, NPCs, perigos, tesouros, caminhos e ocorrências excepcionais.

## Conteúdo e equilíbrio

São 96 definições nas 16 áreas, 16 caminhos permanentes, 16 mapas, 16 insígnias e um kit reutilizável. Os mapas e o kit são fabricados nas vilas usando materiais existentes. A ajuda ao contato regional desbloqueia sua receita; o diário acompanha os registros.

Na trilha principal: coleta 35%, NPC 20%, perigo 15%, tesouro 25%, descoberta 4,5%, excepcional 0,5%. Caminhos favorecem coleta/tesouro redistribuindo apenas os 95% comuns. Frequências raras permanecem iguais. Uma ocorrência rara exige uma escolha bem-sucedida: não garante equipamento. Não há pity.

Chance de teste = `clamp(10, 90, round(50 + (atributo - alvo)/(2*alvo)*100 + bônus))`. Usa atributos efetivos; afinidades raciais já foram aplicadas. Ferramentas aplicam apenas o maior bônus compatível, nunca multiplicam pela quantidade. Mapas dão +10 pontos percentuais na sua região; insígnias equipadas dão +8.

Coleta segura entrega um material e zero XP. Arriscar entrega mais dois se der certo. Tesouros podem dar 4–8 Zeni além do material inicial. NPCs dão 10 XP uma vez; caminhos, 20 XP uma vez. Insígnias são únicas por região. Combates concedem suas recompensas normais, com as mesmas regras e penalidades existentes.

Achados permanecem pendentes até concluir. Falha/abandono descarta apenas esses achados. Custos pagos não voltam. Perigos ambientais causam 40% do HP máximo, ou 60% em cápsulas excepcionais; podem matar. Emboscadas usam o motor de combate existente. Vitória guarda achados pendentes; derrota/empate perde esses achados. Poções podem ser usadas no encontro; durante combate vale o sistema de cinturão.

## Persistência e segurança

`exploration_events` e `exploration_routes` são catálogos administrativos. `exploration_sessions` guarda a definição congelada, os sorteios privados, a revisão, o estágio, os custos/achados e a associação ao combate. Um índice parcial permite apenas um encontro pendente por personagem. O lock transacional do personagem e os recibos de idempotência protegem todas as ações e recompensas. O cooldown de 12 segundos usa o relógio do banco, desde o início de cada saída.

O cliente envia apenas `areaId`/`routeId` para iniciar, e `encounterId`, `revision`, `choiceId` para escolher. Abandono exige ID e revisão. Não recebe o catálogo privado, sorteios, etapas futuras ou recompensas futuras. Escolhas inválidas, revisões antigas, rotas não descobertas e tentativas de agir no encontro de outra conta são rejeitadas.

O catálogo privado de encontros é carregado somente para iniciar uma exploração; escolhas usam a definição persistida. Consultas e combates não transferem esses dados do banco. O cooldown de combate mantém a duração configurada e começa ao finalizar a transação de recompensas, evitando que consultas lentas consumam a espera antes da resposta.

Durante um encontro, páginas de consulta e poções continuam disponíveis; novas atividades, compras, fabricação, equipamento e novos combates exigem resolução/abandono. Emboscadas mantêm o bloqueio de navegação existente. Recarregar não sorteia novamente.

## Instalação incremental

1. `npm run db:migrate` aplica as tabelas novas.
2. `npx tsx scripts/seed-exploration.ts` instala somente este conteúdo. Não altera personagens, drops, balanceamento ou catálogos anteriores. O seed completo também inclui este conteúdo para bancos novos.

Encontros existentes mantêm sua definição congelada quando o catálogo é atualizado. Novas definições devem usar IDs existentes de áreas, itens e inimigos comuns da região, custos positivos e destinos de estágio válidos. Os testes verificam referências e integridade do catálogo.

Artes geradas pelo modo integrado de `image_gen` estão em `public/images/exploration`; os prompts estão em `prompts.json`. NPCs e itens foram inspecionados antes da integração. Sprites e cenários de combate existentes permanecem iguais.
