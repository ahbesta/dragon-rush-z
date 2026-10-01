/** Visual scenery only. These actors never create encounters or modify game state. */
export type AmbientSprite = {
  src: string;
  frameWidth: number;
  frameHeight: number;
  frameSeconds: number;
};

const asset = (
  name: string,
  frameWidth: number,
  frameHeight: number,
  frameSeconds: number,
): AmbientSprite => ({
  src: `/images/world-map/ambience/${name}.webp`,
  frameWidth,
  frameHeight,
  frameSeconds,
});

export const ambientSprites = {
  sauropod: asset("dino-sauropod", 192, 160, 1.4),
  predator: asset("dino-predator", 192, 160, 1.1),
  seabird: asset("seabird", 96, 80, 0.65),
  pterosaur: asset("pterosaur", 128, 96, 1),
  bulma: asset("npc-bulma", 80, 112, 0.75),
  kame: asset("npc-kame", 80, 112, 2.8),
  merchant: asset("npc-merchant", 80, 112, 0.9),
  palm: asset("palm", 128, 160, 2.4),
  forest: asset("forest-tree", 160, 160, 2.8),
} satisfies Record<string, AmbientSprite>;

export type AmbientActor = {
  id: string;
  sprite: keyof typeof ambientSprites;
  behavior: "patrol" | "idle" | "flight" | "foliage";
  x: number;
  y: number;
  /** Width in the original 1536px map, scaled with the canvas. */
  width: number;
  seconds: number;
  delay: number;
  dx?: number;
  dy?: number;
};

export const ambientActors: readonly AmbientActor[] = [
  {
    id: "palm-coast",
    sprite: "palm",
    behavior: "foliage",
    x: 31.4,
    y: 61.5,
    width: 96,
    seconds: 4.5,
    delay: -1,
  },
  {
    id: "palm-village",
    sprite: "palm",
    behavior: "foliage",
    x: 79.3,
    y: 73,
    width: 89,
    seconds: 5.3,
    delay: -3,
  },
  {
    id: "forest-west",
    sprite: "forest",
    behavior: "foliage",
    x: 36.5,
    y: 47.8,
    width: 104,
    seconds: 5.8,
    delay: -2,
  },
  {
    id: "forest-east",
    sprite: "forest",
    behavior: "foliage",
    x: 64.8,
    y: 40.3,
    width: 91,
    seconds: 6.4,
    delay: -4,
  },
  {
    id: "sauropod",
    sprite: "sauropod",
    behavior: "patrol",
    x: 62.4,
    y: 33.5,
    width: 174,
    seconds: 42,
    delay: -4,
    dx: 4.2,
    dy: 0.4,
  },
  {
    id: "predator",
    sprite: "predator",
    behavior: "patrol",
    x: 58.5,
    y: 50.7,
    width: 120,
    seconds: 34,
    delay: -15,
    dx: 4.3,
    dy: -0.4,
  },
  {
    id: "bulma",
    sprite: "bulma",
    behavior: "patrol",
    x: 52.8,
    y: 68,
    width: 46,
    seconds: 28,
    delay: -5,
    dx: 3.4,
    dy: 1.2,
  },
  {
    id: "merchant-village",
    sprite: "merchant",
    behavior: "patrol",
    x: 71,
    y: 73.6,
    width: 43,
    seconds: 24,
    delay: -8,
    dx: 4.5,
    dy: -0.6,
  },
  {
    id: "merchant-training",
    sprite: "merchant",
    behavior: "patrol",
    x: 29.7,
    y: 37.6,
    width: 38,
    seconds: 30,
    delay: -2,
    dx: 2,
    dy: 0.5,
  },
  {
    id: "kame",
    sprite: "kame",
    behavior: "idle",
    x: 19.8,
    y: 64.5,
    width: 47,
    seconds: 5.5,
    delay: -1.5,
  },
  {
    id: "seabird-1",
    sprite: "seabird",
    behavior: "flight",
    x: 15,
    y: 7.4,
    width: 41,
    seconds: 37,
    delay: -12,
    dx: 105,
    dy: -2,
  },
  {
    id: "seabird-2",
    sprite: "seabird",
    behavior: "flight",
    x: 19,
    y: 9,
    width: 32,
    seconds: 37,
    delay: -11.5,
    dx: 105,
    dy: -2,
  },
  {
    id: "seabird-3",
    sprite: "seabird",
    behavior: "flight",
    x: 11,
    y: 9.8,
    width: 29,
    seconds: 37,
    delay: -13,
    dx: 105,
    dy: -2,
  },
  {
    id: "seabird-coast",
    sprite: "seabird",
    behavior: "flight",
    x: 14,
    y: 84,
    width: 44,
    seconds: 49,
    delay: -27,
    dx: 105,
    dy: -3,
  },
  {
    id: "pterosaur",
    sprite: "pterosaur",
    behavior: "flight",
    x: 35,
    y: 15,
    width: 66,
    seconds: 64,
    delay: -38,
    dx: 110,
    dy: -4,
  },
];

export const windLeaves = [
  { x: 37, y: 19, delay: -3, seconds: 14 },
  { x: 42, y: 31, delay: -9, seconds: 17 },
  { x: 63, y: 23, delay: -5, seconds: 15 },
  { x: 27, y: 54, delay: -12, seconds: 19 },
  { x: 72, y: 63, delay: -7, seconds: 16 },
] as const;
