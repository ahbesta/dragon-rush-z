# Expansão clássica e dificuldade

As regras v2 mantêm o servidor como autoridade e o PostgreSQL como fonte persistente. Catálogos e requisitos ficam no banco; os componentes só mostram escolhas e prévias. Comandos usam autenticação, lock do personagem, validação e idempotência, incluindo lojas, missões e cada consumível usado na luta.

## Construir um personagem

Há cinco pontos na criação e cinco por nível. Força aumenta ataques físicos; Controle de Ki aumenta dano energético e reserva de Ki; Defesa reduz dano; Resistência aumenta HP e resistência a efeitos; Velocidade influencia iniciativa e esquiva. Equipamentos não recebem o multiplicador de afinidade.

| Raça           | Afinidades acima de 1                |
| -------------- | ------------------------------------ |
| Saiyajin       | Força 1,25; Velocidade 1,10          |
| Humano         | Velocidade 1,20; Controle de Ki 1,15 |
| Namekuseijin   | Defesa 1,20; Resistência 1,15        |
| Majin          | Resistência 1,25; Defesa 1,10        |
| Raça de Freeza | Controle de Ki 1,25; Velocidade 1,10 |

O arredondamento ocorre depois de multiplicar os pontos totais do atributo. A interface mostra a prévia exata. A primeira redistribuição é gratuita; as seguintes custam `50 + 10 × nível` Zeni nas vilas. Redistribuir e equipar não restauram recursos.

## Escolher uma ação de combate

Antes de agir, o jogador vê a iniciativa e a intenção inimiga. Defender reduz o dano em 50% durante toda a rodada, mesmo quando o inimigo começa. Concentrar recupera 20% do Ki máximo, mas recebe 25% mais dano nessa rodada. Técnicas têm Ki, recargas, requisitos e efeitos próprios. Alguns inimigos carregam ataques fortes, envenenam, paralisam ou quebram defesa. Bosses mudam de padrão na segunda fase.

Uma bolsa leva até três tipos de consumível. Cada item gasta uma ação; o limite é três usos por luta, com duas rodadas de recarga compartilhada entre usos. Semente dos Deuses só pode ser usada uma vez e conta nesse limite. Poções restauram uma fração dos recursos máximos: HP comum 35%, forte 60%; Ki comum 30%, forte 55%. Antídoto cura veneno; tônico melhora dano de Ki em 15% por três turnos; refeição só funciona fora da luta. Não há consumo quando o item não teria efeito.

Farm comum admite modo automático e manual. O uso automático de poções começa desativado; o jogador define limites de HP/Ki e quantidade máxima. Bosses e provas são sempre manuais. Trocar a preferência durante um boss não o conclui automaticamente. Consumíveis são debitados no turno em que são usados; fechamento, recarga da página ou mudança para automático não os devolvem nem debitam novamente.

Derrota tira 5% dos Zeni guardados, até 100, e preserva XP, nível, equipamentos e inventário restante. Recursos persistem entre lutas. Descanso completo gratuito continua com 30 segundos, e treinamento concede 10 XP em 30 segundos. As lutas são independentes; não há expedição ou descanso pago.

## Campanha e economia

Seis capítulos cobrem Paozu/Pilaf, Escola Kame e 21º torneio, Jingle/Muscle Tower, Blue/Karin/Tao/Red Ribbon, 22º torneio e Piccolo Daimao. Saibaman fica como encontro extra fora da história clássica. Regiões, mestres e missões exigem conclusão real de objetivos. Vitória sozinha não entrega a missão: o jogador reivindica a recompensa e materiais de entrega são consumidos na transação.

Há cinco vilas para suprimentos, fabricação, venda e troféus. Armas, armaduras, botas e acessórios oferecem atributos e também crítico, esquiva, resistência física, resistência a efeitos ou quebra de guarda. A comparação de equipamentos mostra as diferenças efetivas. Materiais dos inimigos alimentam receitas e missões.

| Recompensa                      | Chance típica por vitória |
| ------------------------------- | ------------------------- |
| Materiais                       | 70%                       |
| Poção de HP / Ki                | 18% / 15%                 |
| Equipamento comum               | 6%                        |
| Equipamento raro                | 2%                        |
| Equipamento especial de boss    | 8%                        |
| Equipamento de revanche Heróica | 10%                       |
| Equipamento épico Heróico       | 1%                        |

As chances estão nos registros de drops e cada registro é sorteado independentemente. Não significam que toda vitória sorteia todos esses tipos. Cada boss garante um troféu; 15 troféus permitem uma troca de equipamento nas vilas. Revanche Heróica exige a vitória normal e nível mínimo, tem atributos fixos maiores e não escala com o jogador. Inimigos muito abaixo do personagem concedem menos XP/Zeni, mantendo as chances de drops.

O ranking é por Power Level calculado, com campanha e nível como desempates e posição pessoal. Só contas autenticadas acessam a lista; emails e IDs de usuário não são expostos. Transformações mantêm a base de requisitos para a próxima etapa.

## Migração e validação

A migration é aditiva. O seed atualiza conteúdo gerenciado sem remover personagens. O backfill converte crescimento antigo em uma distribuição dentro do novo orçamento; mantém nível, XP, Zeni, flags, equipamento e inventário. Recursos atuais são limitados aos novos máximos. Batalhas v1 ativas usam os dados que já tinham sido serializados e só migram ao terminar.

Testes verificam fórmulas, afinidades, orçamento, estados e itens, missões, cadeia inteira da campanha, lojas, crafting, rollback, idempotência, compatibilidade v1 e concorrência local/Neon. Testes Chromium verificam a jornada, arenas, animações, retomada, perfil, scroll e telas de 320 a 1440px. O relatório de balanceamento usa RNG reproduzível em 14 mil combates; seus cenários preparados pressupõem equipamento e técnicas acessíveis naquela fase, e uma política que cura, defende ataques fortes e administra Ki. É uma referência para ajustes futuros, não uma promessa de chance de vitória para qualquer build.

## Arte

As artes novas foram geradas e editadas com a ferramenta integrada de imagens: 24 recortes de personagens clássicos, 12 cenários, 32 ícones de itens e seis técnicas. Os prompts estão em `classic-art-prompts.json`; `scripts/prepare-classic-art.mjs` apenas recorta e converte as fontes em WebP. Fontes temporárias ficam fora do versionamento. Foram corrigidos enquadramentos de asas, caudas e botas, a cauda indevida de Yamcha e a barba de Jackie Chun. Não há texto gerado sobre as imagens; nomes são renderizados pela interface. Os recortes novos recebem movimento da arena; não são sprites com novas poses quadro a quadro.
