# Avisos de progresso e ficha de atributos

A conclusão de objetivos é detectada nos snapshots devolvidos pelo servidor. `readyQuests`
reutiliza `questReady` e `unmetRequirements`: progresso, itens para entrega e requisitos precisam
estar satisfeitos. Missões que já estavam prontas ao abrir o jogo não geram novamente o popup.
Novas conclusões são agrupadas, aparecem uma vez por sessão e aguardam o encerramento da
animação e da revelação de drops. Combates ativos continuam bloqueando a navegação.

O botão do aviso abre Missões, expande o capítulo e foca a recompensa disponível. Ele não
entrega XP, Zeni ou itens. O resgate continua sendo a ação `quest.claim`, validada no servidor.
Adiar o aviso mantém a recompensa no painel de missões.

Treino e descanso usam o relógio sincronizado existente. Ao terminar fora de Treinamento,
um aviso oferece concluir a atividade. O botão envia `activity.finish`; o servidor verifica
o horário e aplica os ganhos. Adiar silencia aquele aviso durante a sessão. Uma atividade
pendente continua disponível após recarregar a página. Na seção de Treinamento, permanece
o botão de conclusão já existente.

`FighterAttributes` é compartilhado pela criação e pela ficha do personagem. A criação
usa `buildAttributes` sem investimento e `deriveBuildStats`. A ficha exibe os atributos
e recursos calculados pelo servidor. O gráfico representa as proporções dos atributos
atuais, sem sugerir teto de evolução. Afinidades, valores de base e bônus aparecem separados.
`BuildPanel` preserva a distribuição manual e as fórmulas de prévia; a confirmação permanece
uma ação validada no servidor. Nenhuma regra de progressão ou combate foi alterada.

Validação: `tests/quest-presentation.test.ts` verifica requisitos, entregas, resgate e
conclusões simultâneas. `tests/e2e/warrior-feedback.spec.ts` cobre as cinco raças, quatro
larguras de tela, distribuição real de pontos, conclusão após combate/drops, resgate
explícito e treino/descanso concluídos em outra seção.
