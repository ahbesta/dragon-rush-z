# Dragon Rush Z

RPG de navegador de fã de **Dragon Ball**, pessoal e sem fins lucrativos. Primeira versão jogável com estado persistido no PostgreSQL e regras calculadas no servidor.

## Jogar localmente

Requer Node.js 24 e npm. No PowerShell, use `npm.cmd` se a política de execução bloquear `npm`.

```powershell
npm.cmd ci
Copy-Item .env.example .env.local
```

Configure `DATABASE_URL` com a conexão pooled do Neon e `DIRECT_DATABASE_URL` com a conexão administrativa. Configure `BETTER_AUTH_URL=http://localhost:3000`.

```powershell
npm.cmd run setup:local
npm.cmd run db:check
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run db:roles
npm.cmd run db:upgrade
npm.cmd run dev
```

Abra **http://localhost:3000** e crie sua conta. `setup:local` gera um segredo aleatório e preserva uma conexão Neon já configurada. `db:roles` cria uma credencial restrita para a aplicação e preserva a conexão administrativa para migrations. Após mudar variáveis, reinicie o servidor.

Se o ambiente já está configurado e as migrations foram aplicadas, basta `npm.cmd run dev`.

### Alternativa de desenvolvimento sem Neon/Docker

Sem uma `DATABASE_URL` configurada, `setup:local` aponta para um PostgreSQL embarcado de desenvolvimento:

```powershell
npm.cmd run setup:local
npm.cmd run db:local
```

Em outro terminal, execute migrations, seed e `dev`. PGlite persiste em `.local/postgres`, escuta somente `127.0.0.1:54329` e serve para desenvolvimento e testes. Produção usa Neon. Seu multiplexador não substitui a verificação de concorrência em PostgreSQL real.

## O que está jogável

- Cadastro, login, logout, sessão de sete dias e páginas protegidas.
- Um personagem por conta; cinco raças, atributos distribuídos manualmente e afinidades raciais.
- Dashboard, atributos, HP, Ki, XP, nível, Power Level, Zeni e atividades recentes.
- Treinamento: 30 segundos e 10 XP; descanso gratuito: 30 segundos e recuperação completa.
- Campanha clássica em seis capítulos, 16 áreas e missões encadeadas: Paozu/Pilaf, Escola Kame/21º torneio, Jingle/Muscle Tower, Blue/Karin/Red Ribbon, 22º torneio e Piccolo Daimao.
- Farm automático ou manual; a primeira vitória contra cada boss ou prova de mestre exige combate manual. Adversários mostram a intenção e a iniciativa antes de cada rodada.
- Defesa, concentração de Ki, veneno, paralisia, quebra de defesa, interrupção e consumíveis durante a luta.
- Equipamentos em quatro slots, atributos secundários, materiais, fabricação, venda e troca de troféus em cinco vilas.
- Bolsas de três tipos de consumível; automático só usa poções se autorizado pelo jogador.
- Soco e Chute iniciais; Rajada de Ki aprendida no nível 2 por 30 Zeni.
- Piccolo Daimao: nível 20, campanha anterior concluída, duas fases, equipamento especial e troféu garantido.
- Kame e Karin são desbloqueados por provas; técnicas clássicas novas incluem Jan Ken, Rogafufuken, Taiyoken, Zanzoken, Dodonpa e Kikohou.
- Revanche Heróica com dificuldade fixa, drops melhores e requisitos próprios.
- Ranking autenticado por Power Level, com filtro de raça, posição pessoal e desempates por campanha e nível; não expõe emails.
- Perfil e alteração de senha. Transformações mantêm a estrutura futura de requisitos.

HP e Ki persistem entre encontros. Derrota custa 5% dos Zeni guardados, limitada a 100; consumíveis gastos permanecem gastos. Níveis, XP e equipamentos são preservados. Descanso permite voltar ao combate. Treino e descanso continuam após fechar o navegador, mas exigem uma conclusão validada pelo servidor; não há treinamento recorrente automático.

## Arquitetura

```text
src/app/             Páginas e endpoints Next.js
src/components/      Interface e estado de apresentação
src/game/            Tipos, validação e regras puras
src/server/          Autenticação, serviços e transações
src/server/db/       Schema Drizzle, conexão e seed
drizzle/             Migrations SQL versionadas
scripts/             Operação de banco e ambiente local
tests/               Regras, persistência, Neon e navegador
```

Os catálogos ficam no banco. O seed em `src/server/db/seed-data.ts` é a fonte administrativa inicial, nunca importada pelo frontend. Novas raças, inimigos, itens e áreas podem ser adicionados como registros. Reexecutar o seed atualiza seus registros conhecidos sem apagar personagens ou conteúdo adicional.

### Regras centralizadas

- XP necessária do nível `L`: `100 + 50 × (L − 1)`.
- Orçamento total: `5 × L` pontos, incluindo cinco na criação. Subir de nível libera pontos; não distribui atributos automaticamente.
- Atributo racial: base + `floor(pontos × afinidade)`; equipamento soma depois, sem multiplicar bônus pela afinidade.
- HP máximo: `100 + 8 × Resistência`.
- Ki máximo: `30 + 6 × Controle de Ki + L − 1`.
- Power Level: `round(4F + 3D + 3V + 3R + 4K + 0,15 HPmax + 0,2 Kimax)`.
- Atributos efetivos incluem equipamentos; trocar equipamento não cura o personagem.
- XP excedente é preservada, inclusive quando uma recompensa concede múltiplos níveis.
- Builds, economia e combate ficam em `src/game/builds.ts`, `economy.ts`, `attributes.ts` e `strategic-combat.ts`.
- XP e Zeni de inimigos abaixo do jogador: diferença de 3 níveis → 50%, 4 → 25%, 5 ou mais → 10%. Drops permanecem iguais.

O motor recebe uma fonte de aleatoriedade injetável para testes. Em execução real, o servidor usa `crypto.randomInt`. Batalhas terminam em derrota, vitória ou após 60 rodadas; empate e derrota não concedem recompensas.

### Escolher como lutar

O seletor **Modo de combate** aparece em todas as telas do personagem. A preferência é salva no banco e continua após logout. Personagens existentes começam em **Automático**, preservando o comportamento anterior.

No **Manual**, exploração, adversários e bosses iniciam uma batalha persistente. Escolha uma das técnicas da sua prioridade de combate ou Soco a cada rodada. O servidor valida a técnica, Ki e recarga e resolve os dois lados conforme a iniciativa. Recarregar ou fechar a página não reinicia a batalha. Treinamento, descanso, itens e alterações de equipamento ficam bloqueados durante a luta.

Você pode trocar a preferência a qualquer momento. Ao escolher **Automático** durante uma luta comum, o mesmo motor resolve as rodadas restantes, preservando recursos e consumíveis já usados. Bosses e provas exigem uma primeira vitória manual; depois, o jogador pode usar automático ou continuar no manual. Cada variante heroica exige sua própria vitória. A recompensa só é concedida quando a batalha termina, em uma única transação.

Durante uma batalha pendente, o menu mantém o jogador na seção atual e mostra um aviso ao tentar sair. Recarregar retoma diretamente a tela de combate; a luta continua salva no servidor.

`characters.combat_mode` armazena a preferência; `active_battles` guarda o estado privado e serializável de uma única batalha por personagem. A API retorna somente a projeção necessária para exibir os recursos, técnicas e eventos. `combat.mode` aceita um modo; `battle.turn` aceita o ID da batalha, a rodada esperada e o ID da técnica. A rodada esperada e a chave de idempotência impedem que requisições simultâneas avancem o mesmo turno duas vezes.

### API e proteção

| Endpoint                    | Finalidade                                        |
| --------------------------- | ------------------------------------------------- |
| `/api/auth/*`               | Cadastro, login, sessão e logout pelo Better Auth |
| `GET /api/game`             | Snapshot privado do personagem autenticado        |
| `POST /api/game/characters` | Criação validada de personagem                    |
| `POST /api/game/actions`    | Comando validado e executado em transação         |
| `GET /api/game/ranking`     | Classificação autenticada por Power Level         |

Comandos aceitam identificadores, decisões permitidas e uma `idempotencyKey` UUID. A alocação aceita pontos inteiros dentro do orçamento disponível; o servidor calcula os atributos. Campos extras são rejeitados. Nenhum endpoint permite definir XP, dano, recompensas, drops ou um `userId` arbitrário.

Cada comando bloqueia a linha do personagem. O relógio do banco valida prazos. Alterações de recursos, inventário, histórico, batalha e comprovante da ação são atômicas. Repetir uma chave retorna o resultado original; reutilizá-la em outro comando é rejeitado. O frontend preserva a chave quando a conexão ou o servidor falha.

Sessões são verificadas no servidor, sem cache de cookie que prolongue sessões revogadas. Mutação exige origem válida e JSON. Limites de autenticação e de ações são persistidos e atômicos entre instâncias. A role da aplicação lê catálogos e altera apenas tabelas operacionais; migrations usam outra credencial.

Logs de batalha possuem `version`, sequência, rodada, ator, alvo e eventos tipados: início, ataque, habilidade, dano, efeito, fase, derrota, recompensa e término. Futuros efeitos visuais podem consumir esse contrato sem alterar o motor.

## Verificação

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:neon
npm.cmd run test:e2e
npm.cmd run balance:report
npm.cmd run build
```

`npm test` usa um PostgreSQL embarcado descartável, aplica migrations, testa seed repetível, regras, concorrência, restrições e rollback. Os testes Neon são habilitados somente por `test:neon`, que cria e remove usuários isolados de teste no banco configurado.

O teste de navegador usa Chromium; instale-o com `npx playwright install chromium` se necessário. Ele verifica cadastro, alocação, treinamento real de 30 segundos, missões, compras, equipamento, poções em boss manual, ranking, sessão e layout mobile. Fixtures isoladas preparam batalhas avançadas; a jornada inicial sobe ao nível 2 pelo fluxo real. Contas descartáveis são removidas ao final. Capturas ficam em `.local/screenshots`. O teste transacional percorre todos os capítulos, registrando vitórias pelo serviço; não mede o tempo necessário para subir de nível.

O relatório `docs/balance-report.json` contém 14 mil combates reproduzíveis com cinco raças, builds e uma política de decisões explícita. Ele compara personagens preparados e sem suprimentos/equipamentos; não representa todas as builds possíveis. Consulte [as regras e decisões de balanceamento](docs/classic-expansion.md).

Os testes de combate cobrem escolha de golpes, Ki insuficiente, recargas, retomada, conclusão manual, troca para automático, bosses e persistência da preferência após login. Para testar uma instância separada, configure `E2E_BASE_URL` e opcionalmente `E2E_SERVER_COMMAND` (por exemplo, `npm run start -- --port 3001`, após o build). `BETTER_AUTH_URL` deve corresponder à URL dessa instância.

## Deploy na Vercel

1. Importe `ahbesta/dragon-rush-z` na Vercel, usando o preset **Next.js**, Node.js 24, `npm run build` e diretório raiz padrão.
2. Configure `DATABASE_URL` com a credencial de runtime pooled do Neon.
3. Configure um `BETTER_AUTH_SECRET` aleatório com pelo menos 32 caracteres e `BETTER_AUTH_URL` com a URL HTTPS estável do projeto, sem barra final. Cole os valores sem aspas ou crases; para o portal atual, a URL é `https://dragon-rush-z.vercel.app`. Salve as variáveis para Production e faça um novo deploy para aplicá-las.
4. Aplique migrations e seed explicitamente no banco de destino antes de liberar o jogo. Não são executados no build nem durante requisições.
5. Faça o deploy e verifique cadastro, login, criação e treinamento na URL definitiva.

Não use prefixo `NEXT_PUBLIC_` para segredos. `.env.local`, dados locais e relatórios de testes são ignorados pelo Git. `DIRECT_DATABASE_URL` é administrativa e só é necessária onde migrations são executadas.

A migration `0002_powerful_spencer_smythe.sql` adiciona campanha, economia e builds sem remover personagens, e concede leitura dos novos catálogos à role de runtime. A atualização exige `db:migrate`, `db:seed`, `db:roles` e `db:upgrade` antes de publicar. `db:upgrade` preserva níveis, XP, inventário, equipamento e flags, converte o crescimento antigo em pontos distribuídos e libera a primeira redistribuição gratuita. Batalhas v1 em andamento são preservadas e terminam com suas regras serializadas; o personagem é convertido em seguida.

Use branch/banco separado do Neon para desenvolvimento e previews. Cada ambiente deve ter sua URL de autenticação configurada; origens não são liberadas por wildcard. Ao criar tabelas operacionais novas, inclua os grants de runtime na migration. O workflow de CI verifica formatação, lint, tipos, testes locais e build sem credenciais externas.

O projeto não inclui PvP, chat, guildas, comércio entre jogadores, monetização ou multiplayer em tempo real.

## Interface e arte

A tela inicial prioriza jogar: treinamento direto, exploração, batalha e técnicas em cards ilustrados. O menu superior e o painel de HP/Ki acompanham as telas; no celular, o menu pode ser aberto pelo botão no cabeçalho. A ficha, os equipamentos e o histórico ficam abaixo das ações principais.

A arte está incluída no projeto. O prompt, a origem e a organização dos assets anteriores estão em [docs/visual-assets.md](docs/visual-assets.md); os novos cenários, inimigos, equipamentos e técnicas têm prompts em [docs/classic-art-prompts.json](docs/classic-art-prompts.json). Os recortes passaram por revisão visual e correções de anatomia, identidade e enquadramento.

## Arena 2D

A batalha possui sprites de jogo, cenários por área, HUD compacta, ordem de turnos e comandos integrados à parte inferior. Os efeitos acompanham os eventos do servidor. As velocidades 1x/2x/3x persistem no navegador; pular e rever não repetem recompensas. A interface respeita movimento reduzido. Consulte [a arquitetura e as artes da arena](docs/battle-arena.md).
