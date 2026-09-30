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
export const actionInput = z.discriminatedUnion("action", [
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
      slot: z.enum(["weapon", "armor", "accessory"]),
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
