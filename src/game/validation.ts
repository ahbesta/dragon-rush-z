import { z } from "zod";
const id = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9_-]+$/);
export const characterInput = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Use pelo menos 3 caracteres")
      .max(24)
      .regex(/^[\p{L}\p{N} _'-]+$/u, "Nome contém caracteres inválidos"),
    raceId: id,
    idempotencyKey: z.uuid(),
  })
  .strict();
const key = { idempotencyKey: z.uuid() };
const allocation = z
  .object({
    strength: z.number().int().min(0).max(100000),
    defense: z.number().int().min(0).max(100000),
    speed: z.number().int().min(0).max(100000),
    endurance: z.number().int().min(0).max(100000),
    kiControl: z.number().int().min(0).max(100000),
  })
  .strict();
export const actionInput = z.discriminatedUnion("action", [
  z
    .object({ ...key, action: z.literal("exploration.start"), areaId: id, routeId: id.optional() })
    .strict(),
  z
    .object({
      ...key,
      action: z.literal("exploration.choose"),
      encounterId: z.uuid(),
      revision: z.number().int().min(0),
      choiceId: id,
    })
    .strict(),
  z
    .object({
      ...key,
      action: z.literal("exploration.abandon"),
      encounterId: z.uuid(),
      revision: z.number().int().min(0),
    })
    .strict(),
  z.object({ ...key, action: z.literal("attributes.allocate"), points: allocation }).strict(),
  z.object({ ...key, action: z.literal("attributes.respec"), settlementId: id }).strict(),
  z
    .object({
      ...key,
      action: z.literal("belt.select"),
      itemIds: z
        .array(id)
        .max(3)
        .refine((ids) => new Set(ids).size === ids.length),
    })
    .strict(),
  z
    .object({
      ...key,
      action: z.literal("auto.items"),
      enabled: z.boolean(),
      hpThreshold: z.number().int().min(10).max(60),
      kiThreshold: z.number().int().min(10).max(60),
      maxUses: z.number().int().min(1).max(3),
    })
    .strict(),
  z
    .object({
      ...key,
      action: z.literal("battle.action"),
      battleId: z.uuid(),
      round: z.number().int().min(1).max(60),
      command: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("guard") }).strict(),
        z.object({ kind: z.literal("charge") }).strict(),
        z.object({ kind: z.literal("item"), itemId: id }).strict(),
      ]),
    })
    .strict(),
  z
    .object({
      ...key,
      action: z.literal("shop.buy"),
      offerId: id,
      quantity: z.number().int().min(1).max(99),
    })
    .strict(),
  z
    .object({
      ...key,
      action: z.literal("shop.sell"),
      settlementId: id,
      itemId: id,
      quantity: z.number().int().min(1).max(99),
    })
    .strict(),
  z
    .object({
      ...key,
      action: z.literal("recipe.craft"),
      recipeId: id,
      quantity: z.number().int().min(1).max(99),
    })
    .strict(),
  z.object({ ...key, action: z.literal("quest.claim"), questId: id }).strict(),
  z
    .object({ ...key, action: z.literal("combat.mode"), mode: z.enum(["automatic", "manual"]) })
    .strict(),
  z
    .object({
      ...key,
      action: z.literal("battle.turn"),
      battleId: z.uuid(),
      round: z.number().int().min(1).max(60),
      techniqueId: id,
    })
    .strict(),
  z.object({ ...key, action: z.literal("training.start") }).strict(),
  z.object({ ...key, action: z.literal("rest.start") }).strict(),
  z.object({ ...key, action: z.literal("activity.finish"), activityId: z.uuid() }).strict(),
  z.object({ ...key, action: z.literal("explore"), areaId: id }).strict(),
  z.object({ ...key, action: z.literal("battle"), areaId: id, enemyId: id }).strict(),
  z.object({ ...key, action: z.literal("boss"), enemyId: id }).strict(),
  z.object({ ...key, action: z.literal("item.use"), itemId: id }).strict(),
  z.object({ ...key, action: z.literal("equipment.equip"), itemId: id }).strict(),
  z
    .object({
      ...key,
      action: z.literal("equipment.unequip"),
      slot: z.enum(["weapon", "armor", "boots", "accessory"]),
    })
    .strict(),
  z.object({ ...key, action: z.literal("technique.learn"), techniqueId: id }).strict(),
  z
    .object({
      ...key,
      action: z.literal("technique.select"),
      techniqueIds: z
        .array(id)
        .min(1)
        .max(3)
        .refine((ids) => new Set(ids).size === ids.length, "Técnicas repetidas"),
    })
    .strict(),
]);
export type GameAction = z.infer<typeof actionInput>;
export type ActionPayload = GameAction extends infer T
  ? T extends GameAction
    ? Omit<T, "idempotencyKey">
    : never
  : never;
