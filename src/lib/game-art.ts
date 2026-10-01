export type GameArtwork = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

export const activityAnimationArtwork = {
  training: {
    src: "/images/activities/treino-kame.webp",
    alt: "Goku e Kuririn entregam leite com cascos de tartaruga durante o treinamento do Mestre Kame",
    width: 3840,
    height: 360,
  },
  rest: {
    src: "/images/activities/descanso-kame.webp",
    alt: "Goku, Kuririn e Yamcha relaxam na banheira da Kame House, com Puar ao lado",
    width: 3840,
    height: 360,
  },
} satisfies Record<"training" | "rest", GameArtwork>;

const arena = (name: string, alt: string): GameArtwork => ({
  src: `/images/arenas/${name}.webp`,
  alt,
  width: 1600,
  height: 900,
});
export const battleArenaArtwork: Record<string, GameArtwork> = {
  floresta: arena("floresta", "Clareira da Floresta com montanhas ao fundo"),
  montanhas: arena("montanhas", "Planalto rochoso entre os cânions da Terra"),
  deserto: arena("deserto", "Arena de areia no Deserto ao pôr do sol"),
  "red-ribbon": arena("red-ribbon", "Pátio de combate da fortaleza Red Ribbon"),
  "palacio-daimao": arena("palacio-daimao", "Pátio do palácio do Rei Demônio"),
} satisfies Record<string, GameArtwork>;
export type SpriteSheet = {
  src: string;
  alt: string;
  scale: number;
  frames?: 1 | 3 | 4;
  frameWidth?: number;
};
export const playerBattleSprites: Readonly<Partial<Record<string, SpriteSheet>>> = {
  saiyajin: {
    src: "/images/battle-sprites/saiyajin-v2.webp",
    alt: "Sprite Saiyajin de Goku em combate",
    scale: 1,
    frames: 4,
    frameWidth: 208,
  },
  humano: {
    src: "/images/battle-sprites/humano-v2.webp",
    alt: "Sprite Humano de Kuririn em combate",
    scale: 0.8,
    frames: 4,
    frameWidth: 208,
  },
  namekuseijin: {
    src: "/images/battle-sprites/namekuseijin-v2.webp",
    alt: "Sprite Namekuseijin de Piccolo em combate",
    scale: 1.1,
    frames: 4,
    frameWidth: 208,
  },
  majin: {
    src: "/images/battle-sprites/majin-v2.webp",
    alt: "Sprite de Majin Buu em combate",
    scale: 1,
    frames: 4,
    frameWidth: 208,
  },
  freeza: {
    src: "/images/battle-sprites/freeza-v2.webp",
    alt: "Sprite de Freeza em combate",
    scale: 0.9,
    frames: 4,
    frameWidth: 208,
  },
};
export const enemyBattleSprites: Readonly<Partial<Record<string, SpriteSheet>>> = {
  lobo: { src: "/images/battle-sprites/lobo.webp", alt: "Sprite do Lobo em combate", scale: 0.7 },
  bandido: {
    src: "/images/battle-sprites/bandido.webp",
    alt: "Sprite do Bandido em combate",
    scale: 1,
  },
  dinossauro: {
    src: "/images/battle-sprites/dinossauro.webp",
    alt: "Sprite do Dinossauro em combate",
    scale: 1.4,
  },
  saibaman: {
    src: "/images/battle-sprites/saibaman.webp",
    alt: "Sprite do Saibaman em combate",
    scale: 0.75,
  },
  "soldado-red-ribbon": {
    src: "/images/battle-sprites/soldado-red-ribbon.webp",
    alt: "Sprite do Soldado da Red Ribbon em combate",
    scale: 1,
  },
  "piccolo-daimao": {
    src: "/images/battle-sprites/piccolo-daimao.webp",
    alt: "Sprite de Piccolo Daimao em combate",
    scale: 1.2,
  },
};

const scene = (name: string, alt: string): GameArtwork => ({
  src: `/images/scenes/${name}.webp`,
  alt,
  width: 480,
  height: 480,
});
export const areaArtwork: Readonly<Partial<Record<string, GameArtwork>>> = {
  floresta: scene("floresta", "Trilha entre árvores e cachoeiras na Floresta"),
  montanhas: scene("montanhas", "Picos rochosos das Montanhas do Planeta Terra"),
  deserto: scene("deserto", "Dunas e formações rochosas do Deserto"),
  "red-ribbon": scene("red-ribbon", "Fortaleza e torres do exército Red Ribbon"),
};
export const destinationArtwork = {
  training: scene("treinamento", "Campo de treinamento com pesos e boneco de artes marciais"),
  explore: areaArtwork.floresta!,
  battle: scene("combate", "Arena de artes marciais com um choque de energia"),
  techniques: scene("ki", "Esfera de Ki azul cercada por ondas de energia"),
  rest: scene("descanso", "Refúgio tranquilo junto a um oásis para recuperar as forças"),
} satisfies Record<string, GameArtwork>;

export const enemyArtwork: Readonly<Partial<Record<string, GameArtwork>>> = Object.fromEntries(
  [
    ["lobo", "Lobo selvagem de pelagem cinzenta"],
    ["bandido", "Bandido armado das trilhas da Terra"],
    ["dinossauro", "Dinossauro verde do Planeta Terra"],
    ["saibaman", "Saibaman verde em posição de combate"],
    ["soldado-red-ribbon", "Soldado do exército Red Ribbon"],
    ["piccolo-daimao", "Piccolo Daimao, o Rei Demônio"],
  ].map(([id, alt]) => [
    id,
    {
      src: `/images/enemies/${id}.webp`,
      alt,
      width: 480,
      height: id === "piccolo-daimao" ? 720 : 480,
    },
  ]),
);
export const techniqueArtwork: Readonly<Partial<Record<string, GameArtwork>>> = Object.fromEntries(
  [
    ["soco", "Punho em um ataque de Soco"],
    ["chute", "Bota em um golpe de Chute"],
    ["rajada-ki", "Projéteis azuis de Rajada de Ki"],
    ["kamehameha", "Onda de energia azul do Kamehameha"],
    ["masenko", "Explosão de energia amarela do Masenko"],
    ["galick-gun", "Rajada violeta da Galick Gun"],
  ].map(([id, alt]) => [
    id,
    {
      src: `/images/techniques/${id === "chute" ? "chute-v2" : id}.webp`,
      alt,
      width: 480,
      height: 480,
    },
  ]),
);
export const raceArtwork: Readonly<Partial<Record<string, GameArtwork>>> = Object.fromEntries(
  [
    ["saiyajin", "Goku, representante Saiyajin"],
    ["humano", "Kuririn, representante Humano"],
    ["namekuseijin", "Piccolo, representante Namekuseijin"],
    ["majin", "Majin Buu, representante Majin"],
    ["freeza", "Freeza, representante da raça de Freeza"],
  ].map(([id, alt]) => [id, { src: `/images/races/${id}.webp`, alt, width: 360, height: 480 }]),
);

// Catálogo de apresentação. Atributos, requisitos e recompensas pertencem ao banco.
// IDs sem arte cadastrada continuam usando o ícone do componente.
export const itemArtwork: Readonly<Partial<Record<string, GameArtwork>>> = {
  bastao: {
    src: "/images/items/bastao.webp",
    alt: "Bastão vermelho Nyoibo de Goku",
    width: 384,
    height: 384,
  },
  "pocao-hp": {
    src: "/images/items/pocao-hp-v2.webp",
    alt: "Frasco de poção de HP vermelha",
    width: 384,
    height: 384,
  },
  "pocao-ki": {
    src: "/images/items/pocao-ki-v2.webp",
    alt: "Frasco de poção de Ki azul",
    width: 384,
    height: 384,
  },
  "semente-deuses": {
    src: "/images/items/semente-deuses-v2.webp",
    alt: "Sementes dos Deuses em uma pequena bolsa de tecido",
    width: 384,
    height: 384,
  },
  "armadura-simples": {
    src: "/images/items/armadura-simples-v2.webp",
    alt: "Colete de armadura simples",
    width: 384,
    height: 384,
  },
  "armadura-saiyajin": {
    src: "/images/items/armadura-saiyajin-v2.webp",
    alt: "Armadura Saiyajin branca, azul e dourada",
    width: 384,
    height: 384,
  },
};

export const transformationArtwork: Readonly<Partial<Record<string, GameArtwork>>> = {
  oozaru: {
    src: "/images/transformations/oozaru.webp",
    alt: "Oozaru, o macaco gigante Saiyajin, com armadura de combate",
    width: 480,
    height: 720,
  },
  "super-saiyajin": {
    src: "/images/transformations/super-saiyajin.webp",
    alt: "Goku Super Saiyajin com cabelos dourados",
    width: 480,
    height: 720,
  },
  "golden-freeza": {
    src: "/images/transformations/golden-freeza.webp",
    alt: "Freeza em sua forma dourada Golden Freeza",
    width: 480,
    height: 720,
  },
};

export const characterArtwork = {
  goku: { src: "/images/characters/goku.webp", alt: "Goku", width: 440, height: 880 },
  bulma: {
    src: "/images/characters/bulma.webp",
    alt: "Bulma com o Radar do Dragão",
    width: 440,
    height: 880,
  },
  vegeta: { src: "/images/characters/vegeta.webp", alt: "Vegeta", width: 440, height: 880 },
  piccolo: { src: "/images/characters/piccolo.webp", alt: "Piccolo", width: 440, height: 880 },
} satisfies Record<string, GameArtwork>;

const classicFighters = [
  "yamcha",
  "mai-shu",
  "pilaf",
  "prova-kame",
  "giran",
  "nam",
  "jackie-chun",
  "major-metallic",
  "murasaki",
  "buyon",
  "general-white",
  "robo-pirata",
  "general-blue",
  "prova-karin",
  "tao-pai-pai",
  "comandante-black",
  "chaos",
  "tenshinhan",
  "cymbal",
  "tambourine",
  "drum",
  "soldado-neve",
  "oficial-red-ribbon",
];
for (const id of classicFighters) {
  const filename = id === "pilaf" ? "pilaf-v2" : id;
  Object.assign(enemyArtwork, {
    [id]: {
      src: `/images/classic/${filename}.webp`,
      alt: `Adversário clássico: ${id.replaceAll("-", " ")}`,
      width: 384,
      height: 512,
    },
  });
  Object.assign(enemyBattleSprites, {
    [id]: {
      src: `/images/classic/${filename}.webp`,
      alt: `Lutador: ${id.replaceAll("-", " ")}`,
      scale: 1,
      frames: 1,
      frameWidth: id === "pilaf" ? 150 : 160,
    },
  });
}
for (const id of [
  "castelo-pilaf",
  "kame-house",
  "papaya",
  "jingle",
  "muscle-tower",
  "cidade-oeste",
  "caverna-pirata",
  "santuario-karin",
  "torre-karin",
  "planicies-sul",
  "castelo-rei",
]) {
  const art = {
    src: `/images/classic-areas/${id}.webp`,
    alt: `Cenário de ${id.replaceAll("-", " ")}`,
    width: 1200,
    height: 675,
  };
  battleArenaArtwork[id] = art;
  Object.assign(areaArtwork, { [id]: art });
}
battleArenaArtwork["red-ribbon"] = {
  src: "/images/classic-areas/red-ribbon-v2.webp",
  alt: "Quartel-general Red Ribbon",
  width: 1200,
  height: 675,
};
Object.assign(areaArtwork, {
  "encontro-extra": areaArtwork.deserto,
  "red-ribbon": battleArenaArtwork["red-ribbon"],
});

for (const id of [
  "bastao",
  "luvas-combate",
  "espada-deserto",
  "bastao-magico",
  "gi-kame",
  "traje-tsuru",
  "colete-red-ribbon",
  "roupa-termica",
  "botas-leves",
  "botas-reforcadas",
  "botas-agilidade",
  "botas-karin",
  "faixa-foco",
  "braceletes",
  "amuleto-protecao",
  "faixa-mestre",
  "pocao-hp-forte",
  "pocao-ki-forte",
  "antidoto",
  "tonico-foco",
  "refeicao",
  "erva",
  "fruto-ki",
  "couro",
  "presa",
  "tecido",
  "sucata",
  "componente",
  "insignia",
  "trofeu",
  "materiais-bolsa",
  "capsula",
]) {
  Object.assign(itemArtwork, {
    [id]: {
      src: `/images/classic-items/${id}-v2.webp`,
      alt: `Item: ${id.replaceAll("-", " ")}`,
      width: 384,
      height: 384,
    },
  });
}
for (const id of ["jan-ken", "rogafufuken", "taiyoken", "zanzoken", "dodonpa", "kikohou"]) {
  Object.assign(techniqueArtwork, {
    [id]: {
      src: `/images/classic-techniques/${id}.webp`,
      alt: `Técnica: ${id}`,
      width: 480,
      height: 480,
    },
  });
}

Object.assign(enemyArtwork, { "fera-planicies": enemyArtwork.dinossauro });
Object.assign(enemyBattleSprites, { "fera-planicies": enemyBattleSprites.dinossauro });
