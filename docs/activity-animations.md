# Animações de treinamento e descanso

As duas cenas usam seis quadros ilustrados, em atlas WebP horizontal, reproduzidos por CSS como um GIF. O treino mostra Goku e Kuririn entregando leite com os cascos do Mestre Kame; o descanso mostra Goku, Kuririn e Yamcha na banheira da Kame House, com Puar ao lado. A arte corresponde à fase clássica de Dragon Ball.

Assets finais: `public/images/activities/treino-kame.webp` e `public/images/activities/descanso-kame.webp`. Cada atlas tem 3840 × 360 pixels, com seis quadros de 640 × 360. Artes geradas pelo `image_gen` integrado; os prompts completos estão em [activity-art-prompts.json](activity-art-prompts.json). Sharp apenas recorta, redimensiona, organiza os quadros e codifica WebP.

`ActivityAnimation` é montado apenas na página Treinamento, para a atividade correspondente e enquanto seu prazo ainda não terminou. O restante do tempo a página conserva a arte estática. A animação pausa quando sai do viewport ou a aba fica oculta; preferência por movimento reduzido exibe o primeiro quadro sem animação. O componente limpa o observer e a inscrição de visibilidade ao sair da página. Falha no carregamento retorna à arte estática anterior.

O cronômetro vem da atividade persistida e do relógio já sincronizado com o servidor. Animações nunca iniciam, concluem, concedem recompensas ou modificam atividades. Após o prazo, o jogador continua usando a ação existente Concluir atividade para receber o resultado validado no servidor.

O teste `tests/e2e/activity-animation.spec.ts` usa uma conta descartável e atividades reais, verificando os dois ciclos, navegação, recarregamento, expiração, pausa, acessibilidade e ausência de overflow no celular.
