export type Attributes = { strength: number; defense: number; speed: number; endurance: number };
export type Slot = "weapon" | "armor" | "accessory";
export type Rarity = "common" | "uncommon" | "rare" | "epic";
export type Requirements = {
  minLevel?: number;
  minPower?: number;
  raceIds?: string[];
  masterId?: string;
  flags?: string[];
};
export type ItemEffects = {
  attributes?: Partial<Attributes>;
  restoreHp?: number;
  restoreKi?: number;
};
export type TechniqueEffect =
  | { kind: "heal"; fraction: number }
  | { kind: "buff"; attribute: keyof Attributes; amount: number; turns: number };
export type RaceDefinition = {
  id: string;
  name: string;
  description: string;
  trait: string;
  color: string;
  base: Attributes;
  growth: Attributes;
};
export type TechniqueDefinition = {
  id: string;
  name: string;
  description: string;
  kind: "physical" | "ki";
  multiplier: number;
  kiCost: number;
  cooldown: number;
  requirements: Requirements;
  learnCost: number;
  effects: TechniqueEffect[];
};
export type ItemDefinition = {
  id: string;
  name: string;
  description: string;
  type: "consumable" | "equipment";
  rarity: Rarity;
  slot: Slot | null;
  effects: ItemEffects;
  requirements: Requirements;
};
export type AreaDefinition = {
  id: string;
  name: string;
  description: string;
  planet: string;
  minLevel: number;
  order: number;
  color: string;
};
export type BossPhase = { threshold: number; name: string; strengthMultiplier: number };
export type EnemyDefinition = {
  id: string;
  name: string;
  description: string;
  level: number;
  attributes: Attributes;
  maxHp: number;
  maxKi: number;
  xpReward: number;
  zeniReward: number;
  boss: boolean;
  requirements: Requirements;
  techniqueIds: string[];
  phases: BossPhase[];
  powerLevel?: number;
};
export type TransformationDefinition = {
  id: string;
  name: string;
  description: string;
  requirements: Requirements;
  multiplier: number;
  available: boolean;
};
export type MasterDefinition = { id: string; name: string; available: boolean };
export type DropDefinition = {
  enemyId: string;
  itemId: string;
  chance: number;
  minQuantity: number;
  maxQuantity: number;
};
export type ActionPolicy = { id: string; durationSeconds: number; xpReward: number };
export type Catalog = {
  races: RaceDefinition[];
  techniques: TechniqueDefinition[];
  items: ItemDefinition[];
  areas: AreaDefinition[];
  enemies: EnemyDefinition[];
  transformations: TransformationDefinition[];
  masters: MasterDefinition[];
  encounters: { areaId: string; enemyId: string; weight: number }[];
  drops: DropDefinition[];
  policies: ActionPolicy[];
};
export type DerivedStats = Attributes & { maxHp: number; maxKi: number; powerLevel: number };
export type CombatMode = "automatic" | "manual";
export type CombatFighter = {
  name: string;
  hp: number;
  ki: number;
  stats: DerivedStats;
  techniques: TechniqueDefinition[];
  turns: number;
  nextUse: Record<string, number>;
  buffs: { attribute: keyof Attributes; amount: number; expires: number }[];
};
// Estado privado e serializável do motor; nunca aceito como entrada do cliente.
export type CombatState = {
  version: 1;
  id: string;
  areaId?: string;
  round: number;
  player: CombatFighter;
  enemy: CombatFighter;
  definition: EnemyDefinition;
  fallback: TechniqueDefinition;
  drops: DropDefinition[];
  phases: number[];
  events: BattleEvent[];
  result: BattleResult | null;
};
export type ActiveBattle = {
  id: string;
  enemyId: string;
  areaId?: string;
  round: number;
  playerHp: number;
  playerKi: number;
  enemyHp: number;
  enemyKi: number;
  enemyMaxHp: number;
  enemyMaxKi: number;
  techniques: {
    id: string;
    name: string;
    kind: TechniqueDefinition["kind"];
    kiCost: number;
    cooldownRemaining: number;
    available: boolean;
  }[];
  events: BattleEvent[];
};
export type CharacterState = {
  id: string;
  userId: string;
  name: string;
  raceId: string;
  level: number;
  xp: number;
  zeni: number;
  hp: number;
  ki: number;
  base: Attributes;
  flags: string[];
  equipment: Partial<Record<Slot, string>>;
  selectedTechniques: string[];
  combatMode: CombatMode;
  nextBattleAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
export type ActivityState = {
  id: string;
  characterId: string;
  kind: "training" | "rest";
  startedAt: Date;
  finishesAt: Date;
  completedAt: Date | null;
};
export type BattleEvent = { seq: number; round: number } & (
  | {
      type: "start";
      player: string;
      enemy: string;
      playerHp: number;
      enemyHp: number;
      playerKi?: number;
      enemyKi?: number;
      playerMaxHp?: number;
      playerMaxKi?: number;
      enemyMaxHp?: number;
      enemyMaxKi?: number;
    }
  | {
      type: "attack";
      actor: "player" | "enemy";
      target: "player" | "enemy";
      techniqueId: string;
      techniqueName: string;
    }
  | {
      type: "skill";
      actor: "player" | "enemy";
      techniqueId: string;
      kiCost: number;
      remainingKi: number;
    }
  | {
      type: "damage";
      actor: "player" | "enemy";
      target: "player" | "enemy";
      amount: number;
      remainingHp: number;
    }
  | { type: "effect"; actor: "player" | "enemy"; description: string; remainingHp?: number }
  | { type: "phase"; name: string }
  | { type: "defeat"; actor: "player" | "enemy" }
  | { type: "reward"; xp: number; zeni: number; drops: { itemId: string; quantity: number }[] }
  | { type: "end"; outcome: "victory" | "defeat" | "draw" }
);
export type BattleResult = {
  version: 1;
  id: string;
  enemyId: string;
  areaId?: string;
  outcome: "victory" | "defeat" | "draw";
  playerHp: number;
  playerKi: number;
  xp: number;
  zeni: number;
  drops: { itemId: string; quantity: number }[];
  events: BattleEvent[];
};
export type HistoryEntry = { id: string; kind: string; description: string; createdAt: string };
export type GameSnapshot = {
  serverTime: string;
  character: Omit<CharacterState, "userId" | "createdAt" | "updatedAt" | "nextBattleAt"> & {
    nextBattleAt: string | null;
  };
  stats: DerivedStats;
  xpRequired: number;
  race: RaceDefinition;
  catalog: Catalog;
  inventory: { itemId: string; quantity: number }[];
  learnedTechniques: string[];
  unlockedTransformations: string[];
  activity: { id: string; kind: "training" | "rest"; finishesAt: string } | null;
  history: HistoryEntry[];
  latestBattle: BattleResult | null;
  activeBattle: ActiveBattle | null;
};
