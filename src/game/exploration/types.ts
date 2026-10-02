import type { Attributes, Requirements, Rarity } from "../types";

export type ExplorationCategory =
  "gather" | "npc" | "danger" | "treasure" | "discovery" | "exceptional";
export type ExplorationReward = {
  items: { itemId: string; quantity: number }[];
  zeni: number;
  xp: number;
  flags: string[];
};
export type ExplorationRewardDefinition = {
  items?: { itemId: string; min: number; max: number }[];
  zeni?: { min: number; max: number };
  xp?: number;
  flags?: string[];
};
export type ExplorationOutcome = {
  message: string;
  reward?: ExplorationRewardDefinition;
  nextStageId?: string;
  enemyId?: string;
  damageHpFraction?: number;
  loseFinds?: boolean;
};
export type ExplorationChoice = {
  id: string;
  label: string;
  description: string;
  risk: string;
  cost?: { ki?: number; zeni?: number; items?: { itemId: string; quantity: number }[] };
  check?: { attribute: keyof Attributes; target: number };
  requirement?: { attribute?: keyof Attributes; minimum?: number; itemId?: string };
  onceFlag?: string;
  success: ExplorationOutcome;
  failure?: ExplorationOutcome;
};
export type ExplorationEventDefinition = {
  id: string;
  areaId: string;
  category: ExplorationCategory;
  rarity: Rarity;
  weight: number;
  title: string;
  description: string;
  npcId?: string;
  npcName?: string;
  artKind: "plants" | "capsule" | "treasure" | "danger" | "path" | "npc";
  requirements: Requirements;
  stages: { id: string; title: string; text: string; choices: ExplorationChoice[] }[];
};
export type ExplorationRoute = {
  id: string;
  areaId: string;
  name: string;
  description: string;
  discoveryFlag: string;
  favoredCategories: ExplorationCategory[];
};
export type ExplorationStatus = "active" | "battle" | "success" | "failed" | "abandoned";
export type ExplorationSession = {
  id: string;
  areaId: string;
  routeId: string | null;
  event: ExplorationEventDefinition;
  stageId: string;
  revision: number;
  status: ExplorationStatus;
  attributes: Attributes;
  pending: ExplorationReward;
  granted: ExplorationReward;
  lost: ExplorationReward;
  message: string;
  log: string[];
  battleId?: string;
  enemyId?: string;
  rolls: Record<string, { chance: number; success: ExplorationReward; failure: ExplorationReward }>;
};
export type ExplorationChoiceView = Pick<
  ExplorationChoice,
  "id" | "label" | "description" | "risk" | "cost" | "check"
> & {
  chance: number;
  reasons: string[];
};
export type ActiveExploration = {
  id: string;
  areaId: string;
  routeId: string | null;
  title: string;
  description: string;
  npcId?: string;
  npcName?: string;
  artKind: ExplorationEventDefinition["artKind"];
  category: ExplorationCategory;
  rarity: Rarity;
  stageId: string;
  revision: number;
  stageTitle: string;
  stageText: string;
  status: "active" | "battle";
  pending: ExplorationReward;
  message: string;
  log: string[];
  battleId?: string;
  choices: ExplorationChoiceView[];
};
export type ExplorationResult = {
  id: string;
  areaId: string;
  title: string;
  rarity: Rarity;
  category: ExplorationCategory;
  status: "success" | "failed" | "abandoned";
  message: string;
  rewards: ExplorationReward;
  lost: ExplorationReward;
  log: string[];
  battleId?: string;
};
