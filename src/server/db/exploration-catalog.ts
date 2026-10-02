import type { Catalog, ItemDefinition, RecipeDefinition } from "@/game/types";
import type {
  ExplorationEventDefinition,
  ExplorationChoice,
  ExplorationRoute,
} from "@/game/exploration/types";

// Regional narratives are content, not client-side reward rules.
const regions = [
  [
    "floresta",
    "Ervas entre as raízes",
    "Viajante do Monte Paozu",
    "Pegadas de dinossauro",
    "Esconderijo dos bandidos",
    "Gruta atrás da cachoeira",
    "erva",
    "speed",
  ],
  [
    "montanhas",
    "Frutos na encosta",
    "Carregador das montanhas",
    "Desmoronamento no desfiladeiro",
    "Carga abandonada",
    "Passagem na parede rochosa",
    "fruto-ki",
    "endurance",
  ],
  [
    "deserto",
    "Cápsulas soterradas",
    "Mercador do deserto",
    "Tempestade de areia",
    "Depósito dos saqueadores",
    "Ruínas sob as dunas",
    "sucata",
    "endurance",
  ],
  [
    "castelo-pilaf",
    "Peças da máquina de Pilaf",
    "Funcionário perdido",
    "Corredor de armadilhas",
    "Almoxarifado de Pilaf",
    "Duto de manutenção",
    "sucata",
    "kiControl",
  ],
  [
    "kame-house",
    "Suprimentos na praia",
    "Tartaruga pede ajuda",
    "Correnteza traiçoeira",
    "Carga trazida pela maré",
    "Enseada atrás da ilha",
    "erva",
    "endurance",
  ],
  [
    "papaya",
    "Preparativos do Tenkaichi Budokai",
    "Organizador do torneio",
    "Ladrão entre a multidão",
    "Bolsa esquecida na arquibancada",
    "Pátio de treino abandonado",
    "tecido",
    "speed",
  ],
  [
    "jingle",
    "Tecidos sob a neve",
    "Suno precisa de suprimentos",
    "Nevasca no caminho",
    "Trenó encalhado",
    "Abrigo na encosta",
    "tecido",
    "endurance",
  ],
  [
    "muscle-tower",
    "Componentes no corredor",
    "Técnico em fuga",
    "Alarme de segurança",
    "Depósito da guarnição",
    "Escadaria de serviço",
    "sucata",
    "speed",
  ],
  [
    "cidade-oeste",
    "Peças da Capsule Corp",
    "Bulma investiga um sinal",
    "Vendedor de cápsulas falsas",
    "Carga de pesquisa perdida",
    "Túnel de inspeção",
    "componente",
    "kiControl",
  ],
  [
    "caverna-pirata",
    "Peças de um mecanismo antigo",
    "Mergulhador sem equipamento",
    "Galeria inundada",
    "Baú com selo pirata",
    "Galeria atrás da comporta",
    "componente",
    "strength",
  ],
  [
    "santuario-karin",
    "Plantas ao pé da torre",
    "Upa prepara uma oferenda",
    "Fera na trilha",
    "Acampamento esquecido",
    "Trilha dos guardiões",
    "erva",
    "endurance",
  ],
  [
    "torre-karin",
    "Suprimentos na plataforma",
    "Karin testa sua atenção",
    "Travessia sobre as nuvens",
    "Cesta presa na torre",
    "Sacada oculta de Karin",
    "fruto-ki",
    "speed",
  ],
  [
    "red-ribbon",
    "Documentos entre os destroços",
    "Mensageiro desertor",
    "Patrulha da Red Ribbon",
    "Depósito militar lacrado",
    "Galeria de infiltração",
    "insignia",
    "kiControl",
  ],
  [
    "planicies-sul",
    "Frutos entre as pedras",
    "Yajirobe procura provisões",
    "Fera à espreita",
    "Acampamento destruído",
    "Trilha por trás dos penhascos",
    "fruto-ki",
    "strength",
  ],
  [
    "castelo-rei",
    "Suprimentos nos escombros",
    "Civil durante a evacuação",
    "Muralha prestes a cair",
    "Armazém sob os destroços",
    "Rota de evacuação",
    "tecido",
    "strength",
  ],
  [
    "encontro-extra",
    "Vegetação alterada",
    "Pesquisador das cápsulas",
    "Saibaman entre as plantas",
    "Contêiner de pesquisa",
    "Perímetro subterrâneo",
    "componente",
    "kiControl",
  ],
] as const;
const npcIds: Record<string, string> = {
  "kame-house": "tartaruga",
  jingle: "suno",
  "cidade-oeste": "bulma",
  "santuario-karin": "upa",
  "torre-karin": "karin",
  "planicies-sul": "yajirobe",
};
const npcNames: Record<string, string> = {
  "kame-house": "Umigame, a tartaruga do Mestre Kame",
  jingle: "Suno",
  "cidade-oeste": "Bulma",
  "santuario-karin": "Upa",
  "torre-karin": "Karin",
  "planicies-sul": "Yajirobe",
};

export function explorationContent(catalog: Catalog) {
  const events: ExplorationEventDefinition[] = [],
    routes: ExplorationRoute[] = [],
    items: ItemDefinition[] = [],
    recipes: RecipeDefinition[] = [];
  for (const [areaId, gather, npc, danger, treasure, path, material, attribute] of regions) {
    const area = catalog.areas.find((a) => a.id === areaId)!;
    const target = 8 + area.minLevel * 2,
      ki = 2 + Math.floor(area.minLevel / 3);
    const routeFlag = `discovery:${areaId}:route`,
      npcFlag = `discovery:${areaId}:npc`,
      relicFlag = `discovery:${areaId}:relic`;
    const enemy = catalog.encounters
      .filter((e) => e.areaId === areaId)
      .map((e) => catalog.enemies.find((enemy) => enemy.id === e.enemyId)!)
      .find((e) => !e.boss);
    const damage = {
      message: "Você perdeu os achados ao escapar. Os ferimentos custaram 40% do HP máximo.",
      damageHpFraction: 0.4,
      loseFinds: true,
    };
    const escape: ExplorationChoice = {
      id: "retreat",
      label: "Voltar em segurança",
      description: "Encerra o encontro e guarda apenas o que já encontrou.",
      risk: "Nenhum custo adicional.",
      success: { message: "Você voltou com os achados seguros." },
    };
    const reward = (count = 1) => ({ items: [{ itemId: material, min: count, max: count }] });
    const event = (
      category: ExplorationEventDefinition["category"],
      title: string,
      text: string,
      choices: ExplorationChoice[],
      second?: ExplorationChoice[],
    ): ExplorationEventDefinition => ({
      id: `${areaId}-${category}`,
      areaId,
      category,
      rarity:
        category === "exceptional"
          ? "epic"
          : category === "discovery"
            ? "rare"
            : category === "treasure"
              ? "uncommon"
              : "common",
      weight: 1,
      title,
      description: text,
      artKind:
        category === "gather"
          ? "plants"
          : category === "treasure"
            ? "treasure"
            : category === "discovery"
              ? "path"
              : category === "npc"
                ? "npc"
                : category === "exceptional"
                  ? "capsule"
                  : "danger",
      npcId: category === "npc" ? npcIds[areaId] : undefined,
      npcName: category === "npc" ? (npcNames[areaId] ?? npc) : undefined,
      requirements: { minLevel: area.minLevel },
      stages: [
        { id: "arrival", title, text, choices },
        ...(second
          ? [
              {
                id: "deeper",
                title: "O último passo",
                text: "Se avançar e falhar, todos os achados deste encontro serão perdidos. O inventário anterior está protegido.",
                choices: second,
              },
            ]
          : []),
      ],
    });
    const push: ExplorationChoice = {
      id: "push",
      label: "Buscar mais fundo",
      description: "Tenta recuperar mais dois materiais antes de sair.",
      risk:
        enemy && !area.hub
          ? "Falha: emboscada. Você só guarda os achados se vencer; perder aplica a penalidade normal de combate."
          : "Falha: perde os achados e 40% do HP máximo; pode ser fatal.",
      cost: { ki },
      check: { attribute, target: target + 4 },
      success: { message: "Você garantiu uma coleta maior.", reward: reward(2) },
      failure:
        enemy && !area.hub
          ? {
              message: "Alguém seguiu seus passos. Vença a emboscada para guardar os achados.",
              enemyId: enemy.id,
            }
          : damage,
    };
    events.push(
      event(
        "gather",
        gather,
        `Há ${catalog.items.find((i) => i.id === material)!.name.toLowerCase()} na região, mas as melhores reservas ficam fora da trilha.`,
        [
          {
            id: "collect",
            label: "Recolher o que está perto",
            description: "Um material, sem teste de atributo.",
            risk: "Sem perigo nesta escolha.",
            success: {
              message: "Você separou um material. Pode guardá-lo ou arriscar mais.",
              reward: reward(),
              nextStageId: "deeper",
            },
          },
          escape,
        ],
        [escape, push],
      ),
    );
    events.push(
      event(
        "npc",
        npc,
        `Um contato em ${area.name} precisa de suprimentos. Sua ajuda pode render conhecimento permanente sobre a região.`,
        [
          {
            id: "help",
            label: "Entregar suprimentos",
            description: "Desbloqueia permanentemente a receita do mapa desta região no mercado.",
            risk: "Os materiais entregues são consumidos.",
            cost: { items: [{ itemId: material, quantity: 3 }] },
            onceFlag: npcFlag,
            success: {
              message: "A ajuda foi aceita. Você aprendeu a fabricar um mapa regional.",
              reward: { xp: 10, flags: [npcFlag] },
            },
          },
          {
            id: "listen",
            label: "Ouvir e seguir viagem",
            description:
              "O viajante conta que caminhos escondidos aparecem raramente. Mapas melhoram seus testes, não a chance de achados raros.",
            risk: "Sem recompensa ou custo.",
            success: { message: "Você ouviu a dica e continuou a viagem." },
          },
          escape,
        ],
      ),
    );
    events.push(
      event(
        "danger",
        danger,
        area.hub
          ? "O perigo vem do ambiente. Sua reação determinará o custo de voltar em segurança."
          : "Algo se move adiante. Um confronto pode acontecer se sua tentativa de passagem falhar.",
        [
          {
            id: "cross",
            label: "Passar sem ser percebido",
            description: "Usa seus atributos para atravessar e recuperar um suprimento.",
            risk:
              enemy && !area.hub
                ? "Falha: emboscada. Vencer guarda os achados; perder descarta tudo e aplica a penalidade normal de combate."
                : "Falha: perde 40% do HP máximo. Pode ser fatal.",
            check: { attribute, target },
            cost: { ki },
            success: {
              message: "Você cruzou o perigo e encontrou um suprimento.",
              reward: reward(),
            },
            failure:
              enemy && !area.hub
                ? {
                    message: "Sua passagem foi detectada. Prepare-se para a emboscada!",
                    enemyId: enemy.id,
                  }
                : damage,
          },
          escape,
        ],
      ),
    );
    events.push(
      event(
        "treasure",
        treasure,
        "O recipiente ainda está fechado. Há marcas de um mecanismo de segurança; forçá-lo exige preparação.",
        [
          {
            id: "open",
            label: "Desarmar e abrir",
            description: "Recupera um material e alguns Zeni; depois você decide se continua.",
            risk: "Falha: 40% do HP máximo e perda dos achados; pode ser fatal.",
            check: { attribute: "kiControl", target },
            cost: { ki },
            success: {
              message: "O compartimento externo abriu. O interior continua protegido.",
              reward: { ...reward(), zeni: { min: 4, max: 8 } },
              nextStageId: "deeper",
            },
            failure: damage,
          },
          {
            id: "tool",
            label: "Usar kit de cápsulas",
            description:
              "A ferramenta reutilizável abre apenas o compartimento externo com segurança.",
            risk: "Sem teste. O kit não é consumido.",
            requirement: { itemId: "kit-exploracao" },
            success: {
              message: "Seu kit isolou o mecanismo.",
              reward: reward(),
              nextStageId: "deeper",
            },
          },
          escape,
        ],
        [escape, push],
      ),
    );
    routes.push({
      id: `${areaId}-route`,
      areaId,
      name: path,
      description:
        "Favorece coleta e tesouros comuns. Descobertas raras continuam em 4,5%; encontros excepcionais em 0,5%.",
      discoveryFlag: routeFlag,
      favoredCategories: ["gather", "treasure"],
    });
    events.push(
      event(
        "discovery",
        path,
        "Você encontrou sinais de um caminho que não aparece nas rotas conhecidas. Para registrá-lo, é preciso atravessar até o fim.",
        [
          {
            id: "discover",
            label: "Registrar o caminho",
            description:
              "Libera uma rota permanente nesta região. Não remove requisitos da campanha.",
            risk: "Falha: perda dos achados e 40% do HP máximo; pode ser fatal.",
            onceFlag: routeFlag,
            check: { attribute, target: target + 5 },
            cost: { ki: ki + 2 },
            success: {
              message: `Caminho descoberto: ${path}.`,
              reward: { xp: 20, flags: [routeFlag] },
            },
            failure: damage,
          },
          escape,
        ],
      ),
    );
    const relicId = `reliquia-${areaId}`;
    items.push({
      id: relicId,
      name: `Insígnia de exploração · ${area.name}`,
      description:
        "Peça exclusiva encontrada ao resolver uma ocorrência excepcional desta região. Equipada, melhora testes de exploração.",
      type: "equipment",
      rarity: "rare",
      slot: "accessory",
      effects: {
        exploration: { bonus: 8, areaIds: [areaId] },
        attributes: { endurance: 2 },
        statusResistance: 0.03,
      },
      requirements: { minLevel: area.minLevel },
      sellPrice: 20,
      source: "Exploração · encontro excepcional",
    });
    events.push(
      event(
        "exceptional",
        `Sinal incomum · ${area.name}`,
        "Uma cápsula selada guarda equipamento de um antigo explorador. O mecanismo pode destruir o conteúdo e ferir quem o força.",
        [
          {
            id: "relic",
            label: "Recuperar a insígnia",
            description: "Recompensa exclusiva, concedida apenas uma vez por região.",
            risk: "Falha: perde os achados e 60% do HP máximo; pode ser fatal.",
            onceFlag: relicFlag,
            requirement: { attribute, minimum: Math.ceil(target * 0.7) },
            check: { attribute, target: target + 10 },
            cost: { ki: ki + 4 },
            success: {
              message: "Você recuperou a insígnia de exploração!",
              reward: { items: [{ itemId: relicId, min: 1, max: 1 }], flags: [relicFlag] },
            },
            failure: {
              ...damage,
              damageHpFraction: 0.6,
              message: "A cápsula rompeu. Você perdeu 60% do HP máximo e todos os achados.",
            },
          },
          escape,
        ],
      ),
    );
    const mapId = `mapa-${areaId}`;
    items.push({
      id: mapId,
      name: `Mapa · ${area.name}`,
      description:
        "Ferramenta reutilizável. Na mochila, concede +10 pontos percentuais aos testes desta região, limitado a 90%. Não aumenta a chance de encontros raros. Apenas o maior bônus de ferramenta é aplicado.",
      type: "material",
      rarity: "uncommon",
      slot: null,
      effects: { exploration: { bonus: 10, areaIds: [areaId] } },
      requirements: { minLevel: area.minLevel },
      sellPrice: 8,
      source: "Receita desbloqueada ao ajudar o NPC regional",
    });
    recipes.push({
      id: `fabricar-${mapId}`,
      settlementId:
        area.minLevel < 7
          ? "paozu"
          : area.minLevel < 10
            ? "jingle"
            : area.minLevel < 11
              ? "oeste"
              : "karin",
      name: `Desenhar ${area.name}`,
      outputItemId: mapId,
      outputQuantity: 1,
      ingredients: [{ itemId: material, quantity: 6 }],
      zeniCost: 20 + 4 * area.minLevel,
      requirements: { minLevel: area.minLevel, flags: [npcFlag] },
    });
  }
  items.push({
    id: "kit-exploracao",
    name: "Kit de cápsulas de exploração",
    description:
      "Ferramenta reutilizável para abrir o primeiro compartimento dos tesouros com segurança. Não protege escolhas posteriores.",
    type: "material",
    rarity: "uncommon",
    slot: null,
    effects: {},
    requirements: { minLevel: 2 },
    sellPrice: 10,
    source: "Receita aprendida com o mercador do deserto",
  });
  recipes.push({
    id: "fabricar-kit-exploracao",
    settlementId: "paozu",
    name: "Montar kit de cápsulas",
    outputItemId: "kit-exploracao",
    outputQuantity: 1,
    ingredients: [
      { itemId: "sucata", quantity: 8 },
      { itemId: "tecido", quantity: 4 },
    ],
    zeniCost: 60,
    requirements: { minLevel: 2, flags: ["discovery:deserto:npc"] },
  });
  return {
    events,
    routes,
    items,
    recipes,
    policy: { id: "exploration", durationSeconds: 12, xpReward: 0 },
  };
}
