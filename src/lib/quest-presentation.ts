import { questReady } from "@/game/economy";
import { unmetRequirements } from "@/game/requirements";
import type { GameSnapshot } from "@/game/types";

/** Presentation only: claiming still validates objectives and rewards on the server. */
export function readyQuests(snapshot: GameSnapshot) {
  const { character, stats, catalog, inventory } = snapshot;
  const context = {
    level: character.level,
    powerLevel: stats.powerLevel,
    raceId: character.raceId,
    flags: character.flags,
  };
  return catalog.quests.filter(
    (quest) =>
      unmetRequirements(quest.requirements, context).length === 0 &&
      questReady(
        quest,
        character.questProgress?.find((progress) => progress.questId === quest.id),
        inventory,
      ),
  );
}
