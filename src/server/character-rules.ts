import { buildAttributes, recommendedAllocation } from "@/game/builds";
import { deriveBuildStats, deriveStats } from "@/game/attributes";
import { applyExperience, xpRequired } from "@/game/progression";
import type { Catalog, CharacterState, ItemDefinition, RaceDefinition } from "@/game/types";

export function statsFor(character: CharacterState, catalog: Catalog) {
  const equipped = Object.values(character.equipment)
    .map((id) => catalog.items.find((i) => i.id === id))
    .filter((i): i is ItemDefinition => Boolean(i));
  return character.rulesVersion === 2
    ? deriveBuildStats(character.base, character.level, equipped)
    : deriveStats(character.base, character.level, equipped);
}
export function upgradeCharacter(character: CharacterState, race: RaceDefinition) {
  if (character.rulesVersion === 2) return;
  character.allocation = recommendedAllocation(race, character.level);
  character.base = buildAttributes(race, character.allocation);
  character.rulesVersion = 2;
  character.respecCount = 0;
  character.belt ??= ["pocao-hp", "pocao-ki", "antidoto"];
  character.autoItems ??= { enabled: false, hpThreshold: 30, kiThreshold: 20, maxUses: 1 };
  character.questProgress ??= [];
}
export function grantExperience(character: CharacterState, amount: number, race: RaceDefinition) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("XP inválida");
  if (character.rulesVersion !== 2) {
    Object.assign(
      character,
      applyExperience(character.level, character.xp, amount, character.base, race),
    );
    return;
  }
  character.xp += amount;
  while (character.xp >= xpRequired(character.level)) {
    character.xp -= xpRequired(character.level);
    character.level++;
  }
}
