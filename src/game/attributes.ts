import type { Attributes, DerivedStats, ItemDefinition } from "./types";
export function calculatePowerLevel(attrs: Attributes, maxHp: number, maxKi: number): number {
  return Math.round(
    4 * attrs.strength +
      3 * attrs.defense +
      3 * attrs.speed +
      2 * attrs.endurance +
      0.2 * maxHp +
      0.3 * maxKi,
  );
}

export function deriveStats(
  base: Attributes,
  level: number,
  items: ItemDefinition[] = [],
): DerivedStats {
  const attrs = { ...base };
  for (const item of items)
    for (const key of Object.keys(attrs) as (keyof Attributes)[])
      attrs[key] += item.effects.attributes?.[key] ?? 0;
  const maxHp = 80 + 10 * attrs.endurance;
  const maxKi = 40 + 5 * attrs.endurance + 5 * (level - 1);
  return { ...attrs, maxHp, maxKi, powerLevel: calculatePowerLevel(attrs, maxHp, maxKi) };
}
