import { Compass, Dumbbell, Heart, Package, Store, Swords, UserRound } from "lucide-react";

export type MapDestination =
  "training" | "rest" | "explore" | "battle" | "market" | "inventory" | "character";
export type MapNavigation =
  "training" | "explore" | "battle" | "techniques" | "inventory" | "settlements";
export type MapPoint = { x: number; y: number };
export const mapCrossroads: MapPoint = { x: 51, y: 52 };

/** Visual coordinates only; access, encounters and prices come from the server catalog. */
export const mapDestinations = [
  {
    id: "training",
    title: "Treinamento",
    subtitle: "Campo do Mestre Kame",
    label: { x: 26, y: 27 },
    path: [
      { x: 40, y: 44 },
      { x: 30, y: 39 },
    ],
    icon: Dumbbell,
  },
  {
    id: "rest",
    title: "Descansar",
    subtitle: "Kame House",
    label: { x: 14, y: 51 },
    path: [
      { x: 38, y: 58 },
      { x: 22, y: 65 },
    ],
    icon: Heart,
  },
  {
    id: "explore",
    title: "Explorar",
    subtitle: "Descubra a Terra",
    label: { x: 51, y: 17 },
    path: [
      { x: 51, y: 39 },
      { x: 51, y: 30 },
    ],
    icon: Compass,
  },
  {
    id: "battle",
    title: "Batalhar",
    subtitle: "Arena de combate",
    label: { x: 83, y: 34 },
    path: [
      { x: 67, y: 47 },
      { x: 81, y: 55 },
    ],
    icon: Swords,
  },
  {
    id: "market",
    title: "Mercado",
    subtitle: "Vilas e suprimentos",
    label: { x: 68, y: 56 },
    path: [
      { x: 56, y: 59 },
      { x: 62, y: 64 },
      { x: 66, y: 71 },
    ],
    icon: Store,
  },
  {
    id: "inventory",
    title: "Inventário",
    mapTitle: "Mochila",
    subtitle: "Seus itens e equipamentos",
    label: { x: 40, y: 58 },
    path: [
      { x: 50, y: 60 },
      { x: 45, y: 70 },
    ],
    icon: Package,
  },
  {
    id: "character",
    title: "Personagem",
    mapTitle: "Guerreiro",
    subtitle: "Sua ficha e atributos",
    label: { x: 51, y: 87 },
    path: [
      { x: 50, y: 65 },
      { x: 52, y: 79 },
    ],
    icon: UserRound,
  },
] as const;

export const mapRaceSprites: Readonly<Partial<Record<string, { src: string; alt: string }>>> = {
  saiyajin: {
    src: "/images/world-map/saiyajin.webp",
    alt: "Goku, representante Saiyajin, caminhando",
  },
  humano: {
    src: "/images/world-map/humano.webp",
    alt: "Kuririn, representante Humano, caminhando",
  },
  namekuseijin: {
    src: "/images/world-map/namekuseijin.webp",
    alt: "Piccolo, representante Namekuseijin, caminhando",
  },
  majin: { src: "/images/world-map/majin.webp", alt: "Majin Buu caminhando" },
  freeza: { src: "/images/world-map/freeza.webp", alt: "Freeza em sua primeira forma caminhando" },
};
