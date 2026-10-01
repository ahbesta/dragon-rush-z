import { applyExperience as legacyProgress } from "../../src/game/progression";
import { buildAttributes, recommendedAllocation } from "../../src/game/builds";
import type { Attributes, RaceDefinition } from "../../src/game/types";
/** Administrative fixture for disposable accounts only; matches the current allocation budget. */
export function applyExperience(
  level: number,
  xp: number,
  amount: number,
  base: Attributes,
  race: RaceDefinition,
) {
  const progress = legacyProgress(level, xp, amount, base, race);
  const allocation = recommendedAllocation(race, progress.level);
  return {
    ...progress,
    allocation,
    base: buildAttributes(race, allocation),
    rulesVersion: 2 as const,
  };
}
