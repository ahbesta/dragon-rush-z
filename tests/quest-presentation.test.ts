import { describe, expect, it } from "vitest";
import { readyQuests } from "@/lib/quest-presentation";
import { seedCatalog } from "@/server/db/seed-data";
import { buildAttributes, emptyAllocation } from "@/game/builds";
import { deriveBuildStats } from "@/game/attributes";
import type { GameSnapshot } from "@/game/types";

function snapshot(): GameSnapshot {
  const race = seedCatalog.races[0];
  const base = buildAttributes(race, emptyAllocation());
  const stats = deriveBuildStats(base, 1);
  return {
    serverTime: new Date().toISOString(),
    race,
    stats,
    catalog: structuredClone(seedCatalog),
    character: {
      id: "character",
      name: "Guerreiro",
      raceId: race.id,
      level: 1,
      xp: 0,
      zeni: 50,
      hp: stats.maxHp,
      ki: stats.maxKi,
      base,
      flags: [],
      equipment: {},
      selectedTechniques: ["soco", "chute"],
      combatMode: "automatic",
      nextBattleAt: null,
      questProgress: [],
    },
    xpRequired: 100,
    inventory: [],
    learnedTechniques: ["soco", "chute"],
    unlockedTransformations: [],
    activity: null,
    latestBattle: null,
    activeBattle: null,
    history: [],
  };
}
describe("Recompensas disponíveis para os avisos", () => {
  it("não anuncia objetivos parciais e ignora recompensas já recebidas", () => {
    const current = snapshot();
    current.character.questProgress = [
      { questId: "floresta", counters: { "0": 1 }, claimed: false },
    ];
    expect(readyQuests(current)).toEqual([]);
    current.character.questProgress[0].counters["0"] = 2;
    expect(readyQuests(current).map((quest) => quest.id)).toEqual(["floresta"]);
    current.character.questProgress[0].claimed = true;
    expect(readyQuests(current)).toEqual([]);
  });
  it("respeita requisitos mesmo que os objetivos estejam completos", () => {
    const current = snapshot();
    current.character.questProgress = [{ questId: "yamcha", counters: { "0": 1 }, claimed: false }];
    expect(readyQuests(current)).toEqual([]);
    current.character.flags.push("quest:floresta");
    expect(readyQuests(current).map((quest) => quest.id)).toEqual(["yamcha"]);
    current.catalog.quests.find((quest) => quest.id === "yamcha")!.requirements.minLevel = 5;
    expect(readyQuests(current)).toEqual([]);
  });
  it("entregas exigem o estoque atual junto com o progresso de treino", () => {
    const current = snapshot();
    current.character.flags.push("quest:pilaf");
    current.character.questProgress = [
      { questId: "treino-kame", counters: { "0": 3 }, claimed: false },
    ];
    current.inventory = [{ itemId: "erva", quantity: 3 }];
    expect(readyQuests(current)).toEqual([]);
    current.inventory[0].quantity = 4;
    expect(readyQuests(current).map((quest) => quest.id)).toEqual(["treino-kame"]);
    current.inventory[0].quantity = 0;
    expect(readyQuests(current)).toEqual([]);
  });
  it("agrupa missões simultâneas sem alterar o estado ou entregar ganhos", () => {
    const current = snapshot();
    current.character.flags.push("quest:floresta");
    current.character.questProgress = [
      { questId: "floresta", counters: { "0": 2 }, claimed: false },
      { questId: "yamcha", counters: { "0": 1 }, claimed: false },
    ];
    const before = structuredClone(current);
    expect(readyQuests(current).map((quest) => quest.id)).toEqual(["floresta", "yamcha"]);
    expect(current).toEqual(before);
  });
});
