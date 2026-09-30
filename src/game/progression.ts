import type { Attributes, RaceDefinition } from "./types";

export function xpRequired(level: number): number {
  return 100 + 50 * (level - 1);
}
export function applyExperience(
  level: number,
  xp: number,
  amount: number,
  base: Attributes,
  race: RaceDefinition,
) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("XP inválida");
  let nextLevel = level;
  let remaining = xp + amount;
  const attributes = { ...base };
  while (remaining >= xpRequired(nextLevel)) {
    remaining -= xpRequired(nextLevel);
    nextLevel++;
    for (const key of Object.keys(attributes) as (keyof Attributes)[])
      attributes[key] += race.growth[key];
  }
  return { level: nextLevel, xp: remaining, base: attributes };
}
