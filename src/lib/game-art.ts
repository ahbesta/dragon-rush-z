export type GameArtwork = {
  src: string;
  alt: string;
  width: number;
  height: number;
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
