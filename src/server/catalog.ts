import { sql } from "drizzle-orm";
import type { Catalog } from "@/game/types";
import type { Db, Transaction } from "./db/client";
import * as s from "./db/schema";
import { calculatePowerLevel, calculateBuildPowerLevel } from "@/game/attributes";
import { rowsAsJson } from "./db/json-query";

// Um round trip para os catálogos. Os nomes das propriedades vêm do schema,
// mantendo camelCase sem duplicar a definição de cada coluna em SQL manual.
export async function readCatalog(
  db: Db | Transaction,
  options: { includeExplorationEvents?: boolean } = {},
): Promise<Catalog> {
  const result = await db.execute<Catalog>(sql`SELECT
    ${rowsAsJson(s.races)} AS races, ${rowsAsJson(s.techniques)} AS techniques,
    ${rowsAsJson(s.items)} AS items, ${rowsAsJson(s.areas)} AS areas,
    ${rowsAsJson(s.enemies)} AS enemies, ${rowsAsJson(s.transformations)} AS transformations,
    ${rowsAsJson(s.masters)} AS masters, ${rowsAsJson(s.encounters)} AS encounters,
    ${rowsAsJson(s.drops)} AS drops, ${rowsAsJson(s.actionPolicies)} AS policies,
    ${rowsAsJson(s.chapters)} AS chapters, ${rowsAsJson(s.quests)} AS quests,
    ${rowsAsJson(s.settlements)} AS settlements, ${rowsAsJson(s.shopOffers)} AS offers,
    ${rowsAsJson(s.recipes)} AS recipes,
    ${options.includeExplorationEvents ? sql`(SELECT COALESCE(jsonb_agg(definition),'[]'::jsonb) FROM exploration_events)` : sql`'[]'::jsonb`} AS "explorationEvents",
    (SELECT COALESCE(jsonb_agg(definition),'[]'::jsonb) FROM exploration_routes) AS "explorationRoutes"`);
  const catalog = result.rows[0];
  return {
    ...catalog,
    areas: catalog.areas.sort((a, b) => a.order - b.order),
    chapters: catalog.chapters.sort((a, b) => a.order - b.order),
    enemies: catalog.enemies.map((e) => ({
      ...e,
      powerLevel:
        e.attributes.kiControl !== undefined
          ? calculateBuildPowerLevel(e.attributes, e.maxHp, e.maxKi)
          : calculatePowerLevel(e.attributes, e.maxHp, e.maxKi),
    })),
  };
}
