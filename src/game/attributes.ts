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

/** Rules v2. Legacy battles keep deriveStats and their serialized v1 attributes. */
export function calculateBuildPowerLevel(attrs: Attributes, maxHp: number, maxKi: number): number {
  return Math.round(
    4 * attrs.strength +
      3 * attrs.defense +
      3 * attrs.speed +
      3 * attrs.endurance +
      4 * (attrs.kiControl ?? 10) +
      0.15 * maxHp +
      0.2 * maxKi,
  );
}
export function deriveBuildStats(
  base: Attributes,
  level: number,
  items: ItemDefinition[] = [],
): DerivedStats {
  const attrs = { ...base, kiControl: base.kiControl ?? 10 };
  let critical = 0.05,
    evasion = 0,
    physicalResistance = 0,
    statusResistance = 0,
    guardBreak = 0;
  for (const item of items) {
    for (const key of Object.keys(attrs) as (keyof Attributes)[])
      attrs[key] = (attrs[key] ?? 0) + (item.effects.attributes?.[key] ?? 0);
    critical += item.effects.critical ?? 0;
    evasion += item.effects.evasion ?? 0;
    physicalResistance += item.effects.physicalResistance ?? 0;
    statusResistance += item.effects.statusResistance ?? 0;
    guardBreak += item.effects.guardBreak ?? 0;
  }
  const maxHp = 100 + 8 * attrs.endurance;
  const maxKi = 30 + 6 * attrs.kiControl + level - 1;
  const powerLevel = calculateBuildPowerLevel(attrs, maxHp, maxKi);
  return {
    ...attrs,
    maxHp,
    maxKi,
    powerLevel,
    critical: Math.min(0.2, critical),
    evasion: Math.min(0.15, evasion),
    physicalResistance: Math.min(0.25, physicalResistance),
    statusResistance: Math.min(
      0.6,
      statusResistance + (attrs.endurance / (attrs.endurance + 100)) * 0.15,
    ),
    guardBreak: Math.min(0.4, guardBreak),
  };
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
