# Treinamento idle

Uma sessão acumula XP por até 24 horas, inclusive offline. Coletar encerra a sessão; uma nova sessão exige uma nova ação do jogador. A coleta fica disponível após cinco minutos completos. Enquanto houver treino pendente, o personagem pode navegar entre telas, mas precisa coletar antes de combater, explorar, descansar ou realizar outra ação de jogo.

| Treino                    | Local               | Mínimo XP/h | % do custo do nível/h | Desbloqueio                                             |
| ------------------------- | ------------------- | ----------: | --------------------: | ------------------------------------------------------- |
| Entrega de leite          | Kame House          |          20 |                    3% | Inicial                                                 |
| Casco pesado              | Ilha do Mestre Kame |          30 |                    4% | Nível 5, vencer a prova de Kame e resgatar sua missão   |
| Reflexos de Karin         | Torre de Karin      |          45 |                    6% | Nível 15, vencer a prova de Karin e resgatar sua missão |
| Silêncio e controle de Ki | Templo de Kami      |          60 |                    8% | Nível 25, vencer Piccolo Daimao e resgatar sua missão   |

### Balanceamento

A curva atual é `100 + 50 × (nível − 1)`. O próximo nível custa 1.250 XP no nível 24; inimigos e missões continuam sendo a fonte principal de progresso ativo. O treino é complementar: `XP/h = max(mínimo do treino, floor(custo do próximo nível × percentual / 100))`.

No nível 24, os rendimentos calculados são 37, 50, 75 e 100 XP/h, ou 888, 1.200, 1.800 e 2.400 XP em 24h; o treino de Popo continua exigindo nível 25 e vitória/missão de Piccolo Daimao. No nível 25, Popo rende 104 XP/h, limitado a 2.496 XP por sessão. Partindo de zero XP nesse nível, isso termina no nível 26 com 1.196 XP, sem saltar dezenas de níveis. O mínimo de 20 XP/h dá 480 XP por dia ao iniciante. A taxa é congelada no início: não cresce dentro da mesma sessão, mesmo se o catálogo mudar.

As missões das provas concedem os vínculos com os mestres Kame e Karin. Apenas nível alto não libera os treinos avançados. Os desafios e suas batalhas continuam usando as regras existentes da campanha.

## Autoridade e persistência

`trainings` armazena nomes, mestre, área, arte, mínimo por hora, percentual da curva, requisitos e ordem. `src/server/db/training-catalog.ts` alimenta o seed. A migration `0005` cadastra os treinos; `0006` aplica o balanceamento por hora e converte eventuais sessões pendentes da versão ainda não publicada por minuto. Sessões antigas de 30 segundos não são convertidas. Não é necessário executar o seed completo nem modificar outros dados de personagens existentes.

`training.start` aceita somente o ID do treino e a chave de idempotência. O servidor valida os requisitos, calcula a taxa a partir do nível persistido, usa o relógio do PostgreSQL e persiste `started_at`, `finishes_at`, `training_id` e a taxa congelada `xp_per_hour`. A fórmula central é `floor(min(segundos completos, 86.400) × XP/h ÷ 3.600)`, em `src/game/training.ts`.

O contador no navegador apenas apresenta uma estimativa usando o relógio sincronizado com o servidor. Também mostra o tempo para o próximo ponto de XP. Não altera XP nem nível. A coleta usa o relógio do banco dentro da transação, verifica propriedade, mínimo de cinco minutos e sessão pendente, concede a recompensa uma única vez e conclui a atividade. O bloqueio do personagem e os recibos de idempotência protegem chamadas simultâneas e repetições. Alterar o relógio do dispositivo, mandar um XP arbitrário ou repetir requisições não aumenta a recompensa.

Sessões iniciadas antes desta atualização, sem ID/taxa, continuam concluindo conforme a regra antiga. O descanso mantém seu tempo e recuperação existentes. A curva de XP, a distribuição de atributos e as regras de combate permanecem as mesmas.

## Apresentação

Quatro destinos selecionáveis apresentam o mestre, cenário, rendimento e requisitos reais da campanha. Selecionar outro destino troca a janela com uma transição curta; durante um treino pendente é necessário coletar antes de iniciar outro. Treino e descanso usam atlas de seis quadros completos de 800 × 450, sem interpolação, com a cadência original de 900ms por ciclo de treino e 3.000ms por ciclo de descanso. As cenas mantêm a proporção 16:9, com legendas fora da arte, e animam somente enquanto a atividade está ativa e sua tela está visível. Pausam fora do viewport/aba e respeitam movimento reduzido. Ao atingir o limite, a cena volta à imagem estática e o aviso existente oferece a coleta.

Artes geradas com o `imagegen` integrado. Assets e prompts completos em [idle-training-art-prompts.json](idle-training-art-prompts.json). O processamento com Sharp apenas recorta e organiza os quadros.

## Verificação

`tests/training.test.ts` verifica fórmula, arredondamento, limite offline, validação e desbloqueios. `tests/persistence.test.ts` verifica transações, taxa congelada, coleta antecipada, propriedade/bloqueios e entrega única sob concorrência. `tests/neon.test.ts` exercita concorrência em PostgreSQL remoto. Os testes de navegador cobrem os quatro destinos, coleta, persistência, notificações, animações, navegação, movimento reduzido, responsividade e ausência de erros de runtime.
