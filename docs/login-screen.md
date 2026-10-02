# Abertura e autenticação

O login tem composição própria de abertura de anime, com uma ilustração exclusiva de Goku na Nuvem Voadora sobre o mar e a Kame House. Não usa os retratos, cenários, cards de raça ou HUD do portal. O logotipo usa a fonte Saiyan Sans já existente no projeto; o formulário tem painel claro, selo de quatro estrelas e botões próprios.

`src/components/auth-screen.tsx` conserva o cliente Better Auth e o fluxo existente de cadastro/login para `/jogo`. Campos, autocomplete, validação HTML e erros continuam disponíveis. Durante uma requisição, a troca entre entrar/cadastrar fica desabilitada e o botão informa a operação em andamento. A proteção e o redirecionamento de sessões autenticadas continuam em `src/app/login/page.tsx`.

`src/app/login/login.css` usa somente seletores `entry-*`, carregados pela página de login. Os estilos permanecem restritos a essa interface mesmo após navegação cliente para o jogo. A imagem conserva a proporção natural; o enquadramento considera a altura do viewport e o espaço disponível antes do formulário. No celular, a composição recorta a região vazia do céu à direita e apresenta o formulário abaixo da arte. As máscaras suavizam as margens do cenário sem atingir Goku ou a nuvem.

Arte final: `public/images/login/nimbus-journey.webp` (1672 × 941, aproximadamente 197 KiB). Foi criada com **imagegen integrado**, conferida antes da integração e convertida para WebP. O prompt completo está em [login-art-prompts.json](login-art-prompts.json). A arte original gerada permanece no diretório de imagens do Codex.

`tests/e2e/auth-screen.spec.ts` verifica sete resoluções, a silhueta completa de Goku/Nimbus, ausência de sobreposição com o formulário, ausência de downloads dos retratos/cenários do portal, cadastro e login reais, erro de senha, sessão após reload e redirecionamento de uma conta autenticada. Usa uma conta descartável, removida ao terminar. As imagens de revisão ficam em `.local/screenshots/login-final-*` e `signup-final-*`, fora do Git. Os testes de jornada e de artes também conferem a transição para o jogo.
