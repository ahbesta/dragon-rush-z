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
  /** Visible standing height relative to Goku; transparent canvas margins do not count. */
  scale: number;
  frames?: 1 | 3 | 4;
  frameWidth?: number;
  frameHeight?: number;
  bounds?: readonly { left: number; right: number; top: number; bottom: number }[];
};
export const playerBattleSprites: Readonly<Partial<Record<string, SpriteSheet>>> = {
  saiyajin: {
    src: "/images/battle-sprites/saiyajin-v2.webp",
    alt: "Sprite Saiyajin de Goku em combate",
    scale: 1,
    frames: 4,
    frameWidth: 208,
    bounds: [
      { left: 55, right: 151, top: 68, bottom: 195 },
      { left: 38, right: 174, top: 70, bottom: 195 },
      { left: 43, right: 165, top: 68, bottom: 194 },
      { left: 34, right: 174, top: 68, bottom: 195 },
    ],
  },
  humano: {
    src: "/images/battle-sprites/humano-v2.webp",
    alt: "Sprite Humano de Kuririn em combate",
    scale: 0.8,
    frames: 4,
    frameWidth: 208,
    bounds: [
      { left: 53, right: 154, top: 66, bottom: 193 },
      { left: 33, right: 174, top: 65, bottom: 193 },
      { left: 37, right: 171, top: 66, bottom: 194 },
      { left: 28, right: 179, top: 68, bottom: 195 },
    ],
  },
  namekuseijin: {
    src: "/images/battle-sprites/namekuseijin-v2.webp",
    alt: "Sprite Namekuseijin de Piccolo em combate",
    scale: 1.2,
    frames: 4,
    frameWidth: 208,
    bounds: [
      { left: 60, right: 146, top: 76, bottom: 195 },
      { left: 40, right: 175, top: 82, bottom: 195 },
      { left: 44, right: 162, top: 82, bottom: 194 },
      { left: 28, right: 180, top: 77, bottom: 195 },
    ],
  },
  majin: {
    src: "/images/battle-sprites/majin-v2.webp",
    alt: "Sprite de Majin Buu em combate",
    scale: 1.15,
    frames: 4,
    frameWidth: 208,
    bounds: [
      { left: 43, right: 159, top: 50, bottom: 179 },
      { left: 33, right: 175, top: 60, bottom: 177 },
      { left: 36, right: 173, top: 58, bottom: 177 },
      { left: 7, right: 200, top: 73, bottom: 195 },
    ],
  },
  freeza: {
    src: "/images/battle-sprites/freeza-v2.webp",
    alt: "Sprite de Freeza em combate",
    scale: 0.84,
    frames: 4,
    frameWidth: 208,
    bounds: [
      { left: 51, right: 158, top: 83, bottom: 195 },
      { left: 33, right: 175, top: 85, bottom: 194 },
      { left: 43, right: 166, top: 86, bottom: 195 },
      { left: 22, right: 185, top: 83, bottom: 195 },
    ],
  },
};
export const enemyBattleSprites: Readonly<Partial<Record<string, SpriteSheet>>> = {
  lobo: {
    src: "/images/battle-sprites/lobo.webp",
    alt: "Sprite do Lobo em combate",
    scale: 0.58,
    bounds: [
      { left: 13, right: 147, top: 101, bottom: 193 },
      { left: 8, right: 151, top: 89, bottom: 179 },
      { left: 15, right: 145, top: 95, bottom: 193 },
    ],
  },
  bandido: {
    src: "/images/battle-sprites/bandido.webp",
    alt: "Sprite do Bandido em combate",
    scale: 1,
    bounds: [
      { left: 27, right: 139, top: 78, bottom: 183 },
      { left: 9, right: 149, top: 82, bottom: 183 },
      { left: 31, right: 132, top: 87, bottom: 185 },
    ],
  },
  dinossauro: {
    src: "/images/battle-sprites/dinossauro.webp",
    alt: "Sprite do Dinossauro em combate",
    scale: 2,
    bounds: [
      { left: 9, right: 146, top: 85, bottom: 195 },
      { left: 9, right: 149, top: 85, bottom: 190 },
      { left: 15, right: 142, top: 60, bottom: 194 },
    ],
  },
  saibaman: {
    src: "/images/battle-sprites/saibaman.webp",
    alt: "Sprite do Saibaman em combate",
    scale: 0.65,
    bounds: [
      { left: 32, right: 125, top: 89, bottom: 185 },
      { left: 10, right: 145, top: 87, bottom: 183 },
      { left: 26, right: 135, top: 83, bottom: 182 },
    ],
  },
  "soldado-red-ribbon": {
    src: "/images/battle-sprites/soldado-red-ribbon.webp",
    alt: "Sprite do Soldado da Red Ribbon em combate",
    scale: 1,
    bounds: [
      { left: 17, right: 130, top: 70, bottom: 193 },
      { left: 23, right: 135, top: 55, bottom: 189 },
      { left: 12, right: 143, top: 68, bottom: 189 },
    ],
  },
  "piccolo-daimao": {
    src: "/images/battle-sprites/piccolo-daimao.webp",
    alt: "Sprite de Piccolo Daimao em combate",
    scale: 1.28,
    bounds: [
      { left: 26, right: 136, top: 61, bottom: 194 },
      { left: 8, right: 152, top: 64, bottom: 194 },
      { left: 17, right: 143, top: 66, bottom: 194 },
    ],
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

// Visible standing height relative to Goku, followed by the artwork's alpha bounds.
// Weapons, tails and wide stances retain their original proportions.
const classicFighters: Record<
  string,
  readonly [scale: number, left: number, right: number, top: number, bottom: number]
> = {
  yamcha: [1.04, 24, 359, 68, 442],
  "mai-shu": [0.98, 24, 359, 98, 412],
  pilaf: [0.52, 24, 359, 64, 447],
  "prova-kame": [0.91, 24, 359, 79, 431],
  giran: [1.5, 24, 359, 93, 418],
  nam: [1.04, 24, 359, 49, 462],
  "jackie-chun": [0.91, 24, 359, 58, 453],
  "major-metallic": [1.65, 24, 359, 49, 461],
  murasaki: [1, 24, 359, 55, 455],
  buyon: [1.6, 24, 359, 89, 422],
  "general-white": [1.02, 26, 356, 32, 479],
  "robo-pirata": [1.75, 24, 359, 52, 458],
  "general-blue": [1.02, 33, 349, 32, 479],
  "prova-karin": [0.53, 24, 359, 67, 443],
  "tao-pai-pai": [1.03, 26, 356, 32, 479],
  "comandante-black": [1.02, 24, 358, 71, 440],
  chaos: [0.48, 24, 359, 42, 468],
  tenshinhan: [1.1, 24, 359, 74, 437],
  cymbal: [1.4, 24, 359, 43, 467],
  tambourine: [1.12, 24, 358, 47, 464],
  drum: [1.45, 24, 359, 54, 456],
  "soldado-neve": [1, 24, 359, 71, 439],
  "oficial-red-ribbon": [1, 24, 359, 60, 450],
};
for (const [id, [scale, left, right, top, bottom]] of Object.entries(classicFighters)) {
  const filename = `${id}-v2`;
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
      scale,
      frames: 1,
      frameWidth: 384,
      frameHeight: 512,
      bounds: [{ left, right, top, bottom }],
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
    src: `/images/classic-areas/${id}-v2.webp`,
    alt: `Cenário de ${id.replaceAll("-", " ")}`,
    width: 1200,
    height: [
      "castelo-pilaf",
      "kame-house",
      "papaya",
      "jingle",
      "muscle-tower",
      "cidade-oeste",
    ].includes(id)
      ? 400
      : 534,
  };
  battleArenaArtwork[id] = art;
  Object.assign(areaArtwork, { [id]: art });
}
battleArenaArtwork["red-ribbon"] = {
  src: "/images/classic-areas/red-ribbon-v3.webp",
  alt: "Quartel-general Red Ribbon",
  width: 1200,
  height: 534,
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
