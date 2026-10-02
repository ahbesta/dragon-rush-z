import type { GameSnapshot } from "@/game/types";
// Presentation merges real, already granted finds with combat drops for one loot reveal.
// The saved battle and all server rewards remain separate.
export function explorationBattlePresentation(snapshot: GameSnapshot): GameSnapshot {
  const battle = snapshot.latestBattle,
    encounter = snapshot.latestExploration;
  if (
    !battle ||
    encounter?.depth !== undefined ||
    snapshot.activeBattle ||
    !encounter?.battleId ||
    encounter.battleId !== battle.id ||
    !encounter.rewards.items.length
  )
    return snapshot;
  const drops = new Map<string, number>();
  for (const drop of [...battle.drops, ...encounter.rewards.items])
    drops.set(drop.itemId, (drops.get(drop.itemId) ?? 0) + drop.quantity);
  return {
    ...snapshot,
    latestBattle: {
      ...battle,
      drops: [...drops].map(([itemId, quantity]) => ({ itemId, quantity })),
    },
  };
}
