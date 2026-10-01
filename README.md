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
- Um personagem por conta; cinco raças, com origem permanente e crescimento próprio.
- Dashboard, atributos, HP, Ki, XP, nível, Power Level, Zeni e atividades recentes.
- Treinamento: 30 segundos e 50 XP; descanso gratuito: 30 segundos e recuperação completa.
- Terra: Floresta (nível 1), Montanhas (2), Deserto (3) e Região da Red Ribbon (4).
- Combates automáticos ou manuais contra Lobo, Bandido, Dinossauro, Saibaman e Soldado da Red Ribbon.
- Drops, consumíveis, equipamentos e bônus de atributos.
- Soco e Chute iniciais; Rajada de Ki aprendida no nível 2 por 30 Zeni.
- Piccolo Daimao: nível 6, vitória contra Soldado da Red Ribbon, duas fases e drops especiais.
- Catálogos e requisitos de técnicas avançadas, mestres e transformações, ainda bloqueados.
- Missões identificadas na interface como uma etapa futura.

HP e Ki persistem entre encontros. Derrota não remove níveis ou itens. Descanso permite voltar ao combate. Treino e descanso continuam após fechar o navegador, mas exigem uma conclusão validada pelo servidor; não há treinamento recorrente automático.

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
- HP máximo: `80 + 10 × Resistência`.
- Ki máximo: `40 + 5 × Resistência + 5 × (L − 1)`.
- Power Level: `round(4F + 3D + 3V + 2R + 0,2 HPmax + 0,3 Kimax)`.
- Atributos efetivos incluem equipamentos; trocar equipamento não cura o personagem.
- XP excedente é preservada, inclusive quando uma recompensa concede múltiplos níveis.
- Dano físico e de Ki, defesa, iniciativa, cooldowns em turnos e fases ficam em `src/game/combat.ts`.

O motor recebe uma fonte de aleatoriedade injetável para testes. Em execução real, o servidor usa `crypto.randomInt`. Batalhas terminam em derrota, vitória ou após 60 rodadas; empate e derrota não concedem recompensas.

### Escolher como lutar

O seletor **Modo de combate** aparece em todas as telas do personagem. A preferência é salva no banco e continua após logout. Personagens existentes começam em **Automático**, preservando o comportamento anterior.

No **Manual**, exploração, adversários e bosses iniciam uma batalha persistente. Escolha uma das técnicas da sua prioridade de combate ou Soco a cada rodada. O servidor valida a técnica, Ki e recarga e resolve os dois lados conforme a iniciativa. Recarregar ou fechar a página não reinicia a batalha. Treinamento, descanso, itens e alterações de equipamento ficam bloqueados durante a luta.

Você pode trocar o modo a qualquer momento, inclusive durante uma atividade. Ao escolher **Automático** com uma batalha manual em andamento, o mesmo motor resolve as rodadas restantes, preservando HP, Ki, recargas, fases e log. A recompensa só é concedida quando a batalha termina, em uma única transação.

`characters.combat_mode` armazena a preferência; `active_battles` guarda o estado privado e serializável de uma única batalha por personagem. A API retorna somente a projeção necessária para exibir os recursos, técnicas e eventos. `combat.mode` aceita um modo; `battle.turn` aceita o ID da batalha, a rodada esperada e o ID da técnica. A rodada esperada e a chave de idempotência impedem que requisições simultâneas avancem o mesmo turno duas vezes.

### API e proteção

| Endpoint                    | Finalidade                                        |
| --------------------------- | ------------------------------------------------- |
| `/api/auth/*`               | Cadastro, login, sessão e logout pelo Better Auth |
| `GET /api/game`             | Snapshot privado do personagem autenticado        |
| `POST /api/game/characters` | Criação validada de personagem                    |
| `POST /api/game/actions`    | Comando validado e executado em transação         |

Comandos aceitam apenas seus identificadores e uma `idempotencyKey` UUID. Campos extras são rejeitados. Nenhum endpoint permite enviar atributos, XP, dano, recompensas, drops ou um `userId` arbitrário.

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
npm.cmd run build
```

`npm test` usa um PostgreSQL embarcado descartável, aplica migrations, testa seed repetível, regras, concorrência, restrições e rollback. Os testes Neon são habilitados somente por `test:neon`, que cria e remove usuários isolados de teste no banco configurado.

O teste de navegador usa Chromium; instale-o com `npx playwright install chromium` se necessário. Ele verifica cadastro até boss, treinamento real de 30 segundos, sessão persistente, segurança da API e layout mobile. A preparação de nível 6 usa uma fixture administrativa para evitar dezenas de combates; nível 2 e aprendizado são obtidos pelo fluxo real. A conta de teste é removida ao final. Capturas ficam em `.local/screenshots`.

Os testes de combate cobrem escolha de golpes, Ki insuficiente, recargas, retomada, conclusão manual, troca para automático, bosses e persistência da preferência após login. Para testar uma instância separada, configure `E2E_BASE_URL` e opcionalmente `E2E_SERVER_COMMAND` (por exemplo, `npm run start -- --port 3001`, após o build). `BETTER_AUTH_URL` deve corresponder à URL dessa instância.

## Deploy na Vercel

1. Importe `ahbesta/dragon-rush-z` na Vercel, usando o preset **Next.js**, Node.js 24, `npm run build` e diretório raiz padrão.
2. Configure `DATABASE_URL` com a credencial de runtime pooled do Neon.
3. Configure um `BETTER_AUTH_SECRET` aleatório com pelo menos 32 caracteres e `BETTER_AUTH_URL` com a URL HTTPS estável do projeto, sem barra final. Cole os valores sem aspas ou crases; para o portal atual, a URL é `https://dragon-rush-z.vercel.app`. Salve as variáveis para Production e faça um novo deploy para aplicá-las.
4. Aplique migrations e seed explicitamente no banco de destino antes de liberar o jogo. Não são executados no build nem durante requisições.
5. Faça o deploy e verifique cadastro, login, criação e treinamento na URL definitiva.

Não use prefixo `NEXT_PUBLIC_` para segredos. `.env.local`, dados locais e relatórios de testes são ignorados pelo Git. `DIRECT_DATABASE_URL` é administrativa e só é necessária onde migrations são executadas.

A migration `0001_abandoned_mysterio.sql` adiciona os modos de combate, preserva os personagens e concede acesso à nova tabela à role de runtime existente. Aplique-a com `npm run db:migrate` usando a conexão administrativa antes de publicar esta versão.

Use branch/banco separado do Neon para desenvolvimento e previews. Cada ambiente deve ter sua URL de autenticação configurada; origens não são liberadas por wildcard. Ao criar tabelas operacionais novas, inclua os grants de runtime na migration. O workflow de CI verifica formatação, lint, tipos, testes locais e build sem credenciais externas.

O projeto não inclui PvP, chat, guildas, comércio, rankings, monetização ou multiplayer em tempo real.

## Interface e arte

A tela inicial prioriza jogar: treinamento direto, exploração, batalha e técnicas em cards ilustrados. O menu superior e o painel de HP/Ki acompanham as telas; no celular, o menu pode ser aberto pelo botão no cabeçalho. A ficha, os equipamentos e o histórico ficam abaixo das ações principais.

A arte está incluída no projeto. O prompt, a origem e a organização dos assets estão em [docs/visual-assets.md](docs/visual-assets.md).

## Arena 2D

A batalha possui dois lutadores em sprites de jogo, cenários por área e animações ligadas aos eventos do servidor. O modo manual permite escolher técnicas; o automático reproduz a luta. Há velocidade 2x, pular e rever, sem repetir recompensas. A interface respeita a preferência de movimento reduzido. Consulte [a arquitetura e as artes da arena](docs/battle-arena.md).
