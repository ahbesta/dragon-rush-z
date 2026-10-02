export type Attributes = {
  strength: number;
  defense: number;
  speed: number;
  endurance: number;
  kiControl?: number;
};
export type AttributeKey = keyof Attributes;
export type Allocation = Required<Attributes>;
export type Slot = "weapon" | "armor" | "boots" | "accessory";
export type Rarity = "common" | "uncommon" | "rare" | "epic";
export type Requirements = {
  minLevel?: number;
  minPower?: number;
  raceIds?: string[];
  masterId?: string;
  flags?: string[];
};
export type ItemEffects = {
  exploration?: { attribute?: AttributeKey; bonus: number; areaIds?: string[] };
  attributes?: Partial<Attributes>;
  restoreHp?: number;
  restoreKi?: number;
  cure?: StatusKind[];
  kiDamageBuff?: number;
  outsideOnly?: boolean;
  critical?: number;
  evasion?: number;
  physicalResistance?: number;
  statusResistance?: number;
  guardBreak?: number;
};
export type TechniqueEffect =
  | { kind: "heal"; fraction: number }
  | { kind: "buff"; attribute: keyof Attributes; amount: number; turns: number }
  | { kind: "status"; status: StatusKind; turns: number }
  | { kind: "interrupt" }
  | { kind: "evasion"; amount: number; turns: number };
export type RaceDefinition = {
  id: string;
  name: string;
  description: string;
  trait: string;
  color: string;
  base: Attributes;
  growth: Attributes;
  affinities?: Allocation;
  kiBase?: number;
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
  hpCost?: number;
};
export type ItemDefinition = {
  id: string;
  name: string;
  description: string;
  type: "consumable" | "equipment" | "material";
  rarity: Rarity;
  slot: Slot | null;
  effects: ItemEffects;
  requirements: Requirements;
  sellPrice?: number;
  source?: string;
};
export type AreaDefinition = {
  id: string;
  name: string;
  description: string;
  planet: string;
  minLevel: number;
  order: number;
  color: string;
  requirements?: Requirements;
  art?: string;
  hub?: boolean;
};
export type BossPhase = {
  threshold: number;
  name: string;
  strengthMultiplier: number;
  pattern?: EnemyMove[];
};
export type StatusKind = "poison" | "paralysis" | "armor-break";
export type EnemyMove = {
  kind: "attack" | "guard" | "charge";
  label: string;
  techniqueId?: string;
  multiplier?: number;
  status?: StatusKind;
};
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
  pattern?: EnemyMove[];
  heroicOf?: string;
  artId?: string;
  guaranteedItem?: string;
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
  explorationEvents?: import("./exploration/types").ExplorationEventDefinition[];
  explorationRoutes?: import("./exploration/types").ExplorationRoute[];
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
  chapters: ChapterDefinition[];
  quests: QuestDefinition[];
  settlements: SettlementDefinition[];
  offers: ShopOffer[];
  recipes: RecipeDefinition[];
};
export type DerivedStats = Attributes & {
  maxHp: number;
  maxKi: number;
  powerLevel: number;
  critical?: number;
  evasion?: number;
  physicalResistance?: number;
  statusResistance?: number;
  guardBreak?: number;
};
export type ChapterDefinition = {
  id: string;
  name: string;
  description: string;
  order: number;
  minLevel: number;
  finaleQuestId: string;
  art: string;
};
export type QuestDefinition = {
  id: string;
  chapterId: string;
  name: string;
  description: string;
  requirements: Requirements;
  objectives: QuestObjective[];
  rewards: {
    xp: number;
    zeni: number;
    items?: { itemId: string; quantity: number }[];
    flags?: string[];
  };
  next?: string;
};
export type QuestObjective =
  | { kind: "defeat"; enemyId: string; quantity: number }
  | { kind: "deliver"; itemId: string; quantity: number }
  | { kind: "train"; quantity: number };
export type SettlementDefinition = {
  id: string;
  name: string;
  npc: string;
  description: string;
  requirements: Requirements;
  art: string;
  respec: boolean;
};
export type ShopOffer = {
  id: string;
  settlementId: string;
  itemId: string;
  price: number;
  requirements: Requirements;
};
export type RecipeDefinition = {
  id: string;
  settlementId: string;
  name: string;
  outputItemId: string;
  outputQuantity: number;
  ingredients: { itemId: string; quantity: number }[];
  zeniCost: number;
  requirements: Requirements;
};
export type QuestProgress = { questId: string; counters: Record<string, number>; claimed: boolean };
export type AutoItems = {
  enabled: boolean;
  hpThreshold: number;
  kiThreshold: number;
  maxUses: number;
};
export type CombatCommand =
  | { kind: "attack"; techniqueId: string }
  | { kind: "guard" }
  | { kind: "charge" }
  | { kind: "item"; itemId: string };
export type CombatStatus = { kind: StatusKind; expires: number };
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
  statuses?: CombatStatus[];
  paralysisImmuneUntil?: number;
  damageBuffUntil?: number;
  damageBuffAmount?: number;
  evasionBuffUntil?: number;
  evasionBuffAmount?: number;
};
// Estado privado e serializável do motor; nunca aceito como entrada do cliente.
export type CombatState = {
  version: 1 | 2;
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
  strategic?: {
    initiative: "player" | "enemy";
    intent: EnemyMove;
    inventory: { itemId: string; quantity: number }[];
    items: ItemDefinition[];
    used: { itemId: string; quantity: number }[];
    itemUses: number;
    nextItemTurn: number;
    senzuUsed: boolean;
    autoItems: AutoItems;
    enemyCharging: boolean;
    playerLevel: number;
  };
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
  version?: 1 | 2;
  manualOnly?: boolean;
  initiative?: "player" | "enemy";
  intent?: EnemyMove;
  statuses?: { player: CombatStatus[]; enemy: CombatStatus[] };
  consumables?: { itemId: string; quantity: number; available: boolean }[];
  itemUses?: number;
  itemCooldown?: number;
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
  rulesVersion?: number;
  allocation?: Allocation;
  respecCount?: number;
  belt?: string[];
  autoItems?: AutoItems;
  questProgress?: QuestProgress[];
  ratedPower?: number;
  campaignOrder?: number;
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
  | {
      type: "effect";
      actor: "player" | "enemy";
      description: string;
      remainingHp?: number;
      remainingKi?: number;
    }
  | { type: "intent"; description: string; initiative: "player" | "enemy" }
  | { type: "phase"; name: string }
  | { type: "defeat"; actor: "player" | "enemy" }
  | { type: "reward"; xp: number; zeni: number; drops: { itemId: string; quantity: number }[] }
  | { type: "end"; outcome: "victory" | "defeat" | "draw" }
);
export type BattleResult = {
  version: 1 | 2;
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
  usedItems?: { itemId: string; quantity: number }[];
  zeniLost?: number;
  rewardMultiplier?: number;
};
export type HistoryEntry = { id: string; kind: string; description: string; createdAt: string };
export type GameSnapshot = {
  activeExploration?: import("./exploration/types").ActiveExploration | null;
  latestExploration?: import("./exploration/types").ExplorationResult | null;
  explorationCooldownAt?: string | null;
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
