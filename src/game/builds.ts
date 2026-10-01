import type { Allocation, Attributes, RaceDefinition } from "./types";

export const attributeKeys = ["strength", "defense", "speed", "endurance", "kiControl"] as const;
export const emptyAllocation = (): Allocation => ({
  strength: 0,
  defense: 0,
  speed: 0,
  endurance: 0,
  kiControl: 0,
});
export const pointBudget = (level: number) => 5 * level;
export const spentPoints = (points: Allocation) =>
  attributeKeys.reduce((sum, key) => sum + points[key], 0);
export const respecCost = (level: number, count: number) => (count === 0 ? 0 : 50 + 10 * level);
export function buildAttributes(
  race: RaceDefinition,
  allocation: Allocation,
): Required<Attributes> {
  return Object.fromEntries(
    attributeKeys.map((key) => [
      key,
      (key === "kiControl" ? (race.kiBase ?? 10) : (race.base[key] ?? 0)) +
        Math.floor(allocation[key] * (race.affinities?.[key] ?? 1)),
    ]),
  ) as Required<Attributes>;
}
/** Migration distributes the old budget, not old attribute gains plus a second budget. */
export function recommendedAllocation(race: RaceDefinition, level: number): Allocation {
  const allocation = emptyAllocation();
  const affinities = race.affinities ?? {
    strength: 1,
    defense: 1,
    speed: 1,
    endurance: 1,
    kiControl: 1,
  };
  const order = [...attributeKeys].sort((a, b) => affinities[b] - affinities[a]);
  const priorities = [order[0], "endurance", order[1], "defense", "kiControl"] as const;
  for (let point = 0; point < pointBudget(level); point++)
    allocation[priorities[point % priorities.length]]++;
  return allocation;
}
