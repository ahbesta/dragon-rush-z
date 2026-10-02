import { sql } from "drizzle-orm";
import type {
  ExplorationEventDefinition,
  ExplorationRoute,
  ExplorationSession,
} from "@/game/exploration/types";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  Attributes,
  BattleResult,
  CombatMode,
  CombatState,
  BossPhase,
  ItemEffects,
  Requirements,
  TechniqueEffect,
  Slot,
  Rarity,
  Allocation,
  AutoItems,
  QuestProgress,
  QuestDefinition,
  SettlementDefinition,
  ShopOffer,
  RecipeDefinition,
  EnemyMove,
} from "@/game/types";

const time = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
export const user = pgTable("auth_user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: time("created_at").notNull().defaultNow(),
  updatedAt: time("updated_at").notNull().defaultNow(),
});
export const session = pgTable(
  "auth_session",
  {
    id: text("id").primaryKey(),
    expiresAt: time("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);
export const account = pgTable(
  "auth_account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: time("access_token_expires_at"),
    refreshTokenExpiresAt: time("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("account_user_idx").on(t.userId),
    uniqueIndex("account_provider_unique").on(t.providerId, t.accountId),
  ],
);
export const verification = pgTable("auth_verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: time("expires_at").notNull(),
  createdAt: time("created_at").notNull().defaultNow(),
  updatedAt: time("updated_at").notNull().defaultNow(),
});
export const rateLimit = pgTable("rate_limit", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: time("expires_at").notNull(),
});
export const actionPolicies = pgTable(
  "action_policies",
  {
    id: text("id").primaryKey(),
    durationSeconds: integer("duration_seconds").notNull(),
    xpReward: integer("xp_reward").notNull(),
  },
  (t) => [check("policy_values", sql`${t.durationSeconds} > 0 AND ${t.xpReward} >= 0`)],
);

export const races = pgTable("races", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  trait: text("trait").notNull(),
  color: text("color").notNull(),
  base: jsonb("base").$type<Attributes>().notNull(),
  growth: jsonb("growth").$type<Attributes>().notNull(),
  affinities: jsonb("affinities")
    .$type<Allocation>()
    .notNull()
    .default({ strength: 1, defense: 1, speed: 1, endurance: 1, kiControl: 1 }),
  kiBase: integer("ki_base").notNull().default(10),
});
export const masters = pgTable("masters", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  available: boolean("available").notNull().default(false),
});
export const trainings = pgTable(
  "trainings",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    masterId: text("master_id")
      .notNull()
      .references(() => masters.id),
    location: text("location").notNull(),
    description: text("description").notNull(),
    artId: text("art_id").notNull(),
    xpPerMinute: integer("xp_per_minute").notNull().default(1),
    baseXpPerHour: integer("base_xp_per_hour").notNull().default(20),
    levelRatePercent: integer("level_rate_percent").notNull().default(3),
    requirements: jsonb("requirements").$type<Requirements>().notNull().default({}),
    order: integer("sort_order").notNull(),
  },
  (t) => [
    check("training_rate_bounds", sql`${t.xpPerMinute} BETWEEN 1 AND 10000`),
    check(
      "training_hourly_bounds",
      sql`${t.baseXpPerHour} BETWEEN 1 AND 10000 AND ${t.levelRatePercent} BETWEEN 0 AND 100`,
    ),
  ],
);
export const techniques = pgTable(
  "techniques",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    kind: text("kind").$type<"physical" | "ki">().notNull(),
    multiplier: doublePrecision("multiplier").notNull(),
    kiCost: integer("ki_cost").notNull(),
    cooldown: integer("cooldown").notNull(),
    requirements: jsonb("requirements").$type<Requirements>().notNull().default({}),
    learnCost: integer("learn_cost").notNull(),
    effects: jsonb("effects").$type<TechniqueEffect[]>().notNull().default([]),
    hpCost: doublePrecision("hp_cost").notNull().default(0),
  },
  (t) => [
    check(
      "technique_values",
      sql`${t.kiCost} >= 0 AND ${t.cooldown} >= 0 AND ${t.multiplier} > 0 AND ${t.learnCost} >= 0`,
    ),
  ],
);
export const items = pgTable(
  "items",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    type: text("type").$type<"consumable" | "equipment" | "material">().notNull(),
    rarity: text("rarity").$type<Rarity>().notNull(),
    slot: text("slot").$type<Slot>(),
    effects: jsonb("effects").$type<ItemEffects>().notNull(),
    requirements: jsonb("requirements").$type<Requirements>().notNull().default({}),
    sellPrice: integer("sell_price").notNull().default(0),
    source: text("source").notNull().default(""),
  },
  (t) => [
    check(
      "item_shape",
      sql`(${t.type} IN ('consumable','material') AND ${t.slot} IS NULL) OR (${t.type} = 'equipment' AND ${t.slot} IN ('weapon', 'armor', 'boots', 'accessory'))`,
    ),
  ],
);
export const areas = pgTable("areas", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  planet: text("planet").notNull(),
  minLevel: integer("min_level").notNull(),
  order: integer("sort_order").notNull(),
  color: text("color").notNull(),
  requirements: jsonb("requirements").$type<Requirements>().notNull().default({}),
  art: text("art").notNull().default("floresta"),
  hub: boolean("hub").notNull().default(false),
});
export const enemies = pgTable(
  "enemies",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    level: integer("level").notNull(),
    attributes: jsonb("attributes").$type<Attributes>().notNull(),
    maxHp: integer("max_hp").notNull(),
    maxKi: integer("max_ki").notNull(),
    xpReward: integer("xp_reward").notNull(),
    zeniReward: integer("zeni_reward").notNull(),
    boss: boolean("boss").notNull().default(false),
    requirements: jsonb("requirements").$type<Requirements>().notNull().default({}),
    techniqueIds: jsonb("technique_ids").$type<string[]>().notNull(),
    phases: jsonb("phases").$type<BossPhase[]>().notNull().default([]),
    pattern: jsonb("pattern").$type<EnemyMove[]>().notNull().default([]),
    heroicOf: text("heroic_of"),
    artId: text("art_id"),
    guaranteedItem: text("guaranteed_item"),
  },
  (t) => [
    check(
      "enemy_values",
      sql`${t.maxHp} > 0 AND ${t.maxKi} >= 0 AND ${t.xpReward} >= 0 AND ${t.zeniReward} >= 0`,
    ),
  ],
);
export const encounters = pgTable(
  "area_enemies",
  {
    areaId: text("area_id")
      .notNull()
      .references(() => areas.id),
    enemyId: text("enemy_id")
      .notNull()
      .references(() => enemies.id),
    weight: integer("weight").notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.areaId, t.enemyId] }),
    check("positive_weight", sql`${t.weight} > 0`),
  ],
);
export const drops = pgTable(
  "enemy_drops",
  {
    enemyId: text("enemy_id")
      .notNull()
      .references(() => enemies.id),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id),
    chance: doublePrecision("chance").notNull(),
    minQuantity: integer("min_quantity").notNull().default(1),
    maxQuantity: integer("max_quantity").notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.enemyId, t.itemId] }),
    check(
      "drop_bounds",
      sql`${t.chance} BETWEEN 0 AND 1 AND ${t.minQuantity} > 0 AND ${t.maxQuantity} >= ${t.minQuantity}`,
    ),
  ],
);
export const transformations = pgTable("transformations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  requirements: jsonb("requirements").$type<Requirements>().notNull(),
  multiplier: doublePrecision("multiplier").notNull(),
  available: boolean("available").notNull().default(false),
});

export const characters = pgTable(
  "characters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" })
      .unique(),
    name: text("name").notNull(),
    raceId: text("race_id")
      .notNull()
      .references(() => races.id),
    level: integer("level").notNull().default(1),
    xp: integer("xp").notNull().default(0),
    zeni: integer("zeni").notNull().default(50),
    hp: integer("hp").notNull(),
    ki: integer("ki").notNull(),
    base: jsonb("base").$type<Attributes>().notNull(),
    flags: jsonb("flags").$type<string[]>().notNull().default([]),
    equipment: jsonb("equipment").$type<Partial<Record<Slot, string>>>().notNull().default({}),
    selectedTechniques: jsonb("selected_techniques")
      .$type<string[]>()
      .notNull()
      .default(["chute", "soco"]),
    combatMode: text("combat_mode").$type<CombatMode>().notNull().default("automatic"),
    nextBattleAt: time("next_battle_at"),
    rulesVersion: integer("rules_version").notNull().default(1),
    allocation: jsonb("allocation")
      .$type<Allocation>()
      .notNull()
      .default({ strength: 0, defense: 0, speed: 0, endurance: 0, kiControl: 0 }),
    respecCount: integer("respec_count").notNull().default(0),
    belt: jsonb("belt").$type<string[]>().notNull().default(["pocao-hp", "pocao-ki", "antidoto"]),
    autoItems: jsonb("auto_items")
      .$type<AutoItems>()
      .notNull()
      .default({ enabled: false, hpThreshold: 30, kiThreshold: 20, maxUses: 1 }),
    questProgress: jsonb("quest_progress").$type<QuestProgress[]>().notNull().default([]),
    ratedPower: integer("rated_power").notNull().default(0),
    campaignOrder: integer("campaign_order").notNull().default(0),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [
    check("character_combat_mode", sql`${t.combatMode} IN ('automatic', 'manual')`),
    check(
      "character_build_values",
      sql`${t.rulesVersion} IN (1,2) AND ${t.respecCount} >= 0 AND ${t.ratedPower} >= 0 AND ${t.campaignOrder} >= 0`,
    ),
    check(
      "character_values",
      sql`${t.level} >= 1 AND ${t.xp} >= 0 AND ${t.zeni} >= 0 AND ${t.hp} >= 0 AND ${t.ki} >= 0`,
    ),
  ],
);
export const chapters = pgTable("chapters", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  order: integer("sort_order").notNull(),
  minLevel: integer("min_level").notNull(),
  finaleQuestId: text("finale_quest_id").notNull(),
  art: text("art").notNull(),
});
export const quests = pgTable("quests", {
  id: text("id").primaryKey(),
  chapterId: text("chapter_id")
    .notNull()
    .references(() => chapters.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  requirements: jsonb("requirements")
    .$type<QuestDefinition["requirements"]>()
    .notNull()
    .default({}),
  objectives: jsonb("objectives").$type<QuestDefinition["objectives"]>().notNull(),
  rewards: jsonb("rewards").$type<QuestDefinition["rewards"]>().notNull(),
  next: text("next"),
});
export const settlements = pgTable("settlements", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  npc: text("npc").notNull(),
  description: text("description").notNull(),
  requirements: jsonb("requirements")
    .$type<SettlementDefinition["requirements"]>()
    .notNull()
    .default({}),
  art: text("art").notNull(),
  respec: boolean("respec").notNull().default(true),
});
export const shopOffers = pgTable(
  "shop_offers",
  {
    id: text("id").primaryKey(),
    settlementId: text("settlement_id")
      .notNull()
      .references(() => settlements.id),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id),
    price: integer("price").notNull(),
    requirements: jsonb("requirements").$type<ShopOffer["requirements"]>().notNull().default({}),
  },
  (t) => [check("offer_price", sql`${t.price} >= 0`)],
);
export const recipes = pgTable(
  "recipes",
  {
    id: text("id").primaryKey(),
    settlementId: text("settlement_id")
      .notNull()
      .references(() => settlements.id),
    name: text("name").notNull(),
    outputItemId: text("output_item_id")
      .notNull()
      .references(() => items.id),
    outputQuantity: integer("output_quantity").notNull(),
    ingredients: jsonb("ingredients").$type<RecipeDefinition["ingredients"]>().notNull(),
    zeniCost: integer("zeni_cost").notNull(),
    requirements: jsonb("requirements")
      .$type<RecipeDefinition["requirements"]>()
      .notNull()
      .default({}),
  },
  (t) => [check("recipe_values", sql`${t.outputQuantity} > 0 AND ${t.zeniCost} >= 0`)],
);
export const explorationEvents = pgTable("exploration_events", {
  id: text("id").primaryKey(),
  areaId: text("area_id")
    .notNull()
    .references(() => areas.id),
  definition: jsonb("definition").$type<ExplorationEventDefinition>().notNull(),
});
export const explorationRoutes = pgTable("exploration_routes", {
  id: text("id").primaryKey(),
  areaId: text("area_id")
    .notNull()
    .references(() => areas.id),
  definition: jsonb("definition").$type<ExplorationRoute>().notNull(),
});
export const explorationSessions = pgTable(
  "exploration_sessions",
  {
    id: uuid("id").primaryKey(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    state: jsonb("state").$type<ExplorationSession>().notNull(),
    startedAt: time("started_at").notNull().defaultNow(),
    completedAt: time("completed_at"),
  },
  (t) => [
    uniqueIndex("one_pending_exploration")
      .on(t.characterId)
      .where(sql`${t.completedAt} IS NULL`),
    index("exploration_character_history").on(t.characterId, t.startedAt),
  ],
);
export const activeBattles = pgTable("active_battles", {
  id: uuid("id").primaryKey(),
  characterId: uuid("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" })
    .unique(),
  state: jsonb("state").$type<CombatState>().notNull(),
  createdAt: time("created_at").notNull().defaultNow(),
  updatedAt: time("updated_at").notNull().defaultNow(),
});
export const inventory = pgTable(
  "inventory",
  {
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.characterId, t.itemId] }),
    check("inventory_positive", sql`${t.quantity} > 0`),
  ],
);
export const learnedTechniques = pgTable(
  "character_techniques",
  {
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    techniqueId: text("technique_id")
      .notNull()
      .references(() => techniques.id),
    learnedAt: time("learned_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.characterId, t.techniqueId] })],
);
export const unlockedTransformations = pgTable(
  "character_transformations",
  {
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    transformationId: text("transformation_id")
      .notNull()
      .references(() => transformations.id),
    unlockedAt: time("unlocked_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.characterId, t.transformationId] })],
);
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"training" | "rest">().notNull(),
    startedAt: time("started_at").notNull().defaultNow(),
    finishesAt: time("finishes_at").notNull(),
    completedAt: time("completed_at"),
    trainingId: text("training_id").references(() => trainings.id),
    xpPerMinute: integer("xp_per_minute"),
    xpPerHour: integer("xp_per_hour"),
  },
  (t) => [
    check(
      "activity_training_rate",
      sql`${t.xpPerMinute} IS NULL OR ${t.xpPerMinute} BETWEEN 1 AND 10000`,
    ),
    check(
      "activity_training_hourly_rate",
      sql`${t.xpPerHour} IS NULL OR ${t.xpPerHour} BETWEEN 1 AND 1000000`,
    ),
    uniqueIndex("one_pending_activity")
      .on(t.characterId)
      .where(sql`${t.completedAt} IS NULL`),
  ],
);
export const battles = pgTable(
  "battles",
  {
    id: uuid("id").primaryKey(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    enemyId: text("enemy_id")
      .notNull()
      .references(() => enemies.id),
    result: jsonb("result").$type<BattleResult>().notNull(),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [index("battle_history_idx").on(t.characterId, t.createdAt)],
);
export const history = pgTable(
  "history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    description: text("description").notNull(),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [index("history_character_idx").on(t.characterId, t.createdAt)],
);
export const actionReceipts = pgTable(
  "action_receipts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    key: uuid("key").notNull(),
    hash: text("hash").notNull(),
    result: jsonb("result").$type<{ message: string; battle?: BattleResult }>().notNull(),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] }), index("receipt_date_idx").on(t.createdAt)],
);
