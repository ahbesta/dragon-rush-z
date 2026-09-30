export type GameArtwork = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

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
    src: "/images/items/pocao-hp.webp",
    alt: "Frasco de poção de HP vermelha",
    width: 384,
    height: 384,
  },
  "pocao-ki": {
    src: "/images/items/pocao-ki.webp",
    alt: "Frasco de poção de Ki azul",
    width: 384,
    height: 384,
  },
  "semente-deuses": {
    src: "/images/items/semente-deuses.webp",
    alt: "Sementes dos Deuses em uma pequena bolsa de tecido",
    width: 384,
    height: 384,
  },
  "armadura-simples": {
    src: "/images/items/armadura-simples.webp",
    alt: "Colete de armadura simples",
    width: 384,
    height: 384,
  },
  "armadura-saiyajin": {
    src: "/images/items/armadura-saiyajin.webp",
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
