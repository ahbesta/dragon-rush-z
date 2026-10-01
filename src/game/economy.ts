import type { CharacterState, ItemDefinition, QuestDefinition, QuestProgress } from "./types";
export const defeatLoss = (zeni: number) => Math.min(100, Math.floor(zeni * 0.05));
export function rewardMultiplier(playerLevel: number, enemyLevel: number) {
  const gap = playerLevel - enemyLevel;
  return gap >= 5 ? 0.1 : gap === 4 ? 0.25 : gap === 3 ? 0.5 : 1;
}
export function itemRecovery(
  hp: number,
  ki: number,
  maxHp: number,
  maxKi: number,
  item: ItemDefinition,
) {
  return {
    hp: Math.min(maxHp, hp + Math.round(maxHp * (item.effects.restoreHp ?? 0))),
    ki: Math.min(maxKi, ki + Math.round(maxKi * (item.effects.restoreKi ?? 0))),
  };
}
export function questReady(
  quest: QuestDefinition,
  progress: QuestProgress | undefined,
  inventory: { itemId: string; quantity: number }[],
) {
  return (
    !progress?.claimed &&
    quest.objectives.every((objective, index) =>
      objective.kind === "deliver"
        ? (inventory.find((i) => i.itemId === objective.itemId)?.quantity ?? 0) >=
          objective.quantity
        : (progress?.counters[String(index)] ?? 0) >= objective.quantity,
    )
  );
}
export function advanceQuests(
  character: CharacterState,
  quests: QuestDefinition[],
  event: { kind: "train" } | { kind: "defeat"; enemyId: string },
  allowed: (quest: QuestDefinition) => boolean,
) {
  const progress = structuredClone(character.questProgress ?? []);
  for (const quest of quests) {
    if (!allowed(quest)) continue;
    let row = progress.find((p) => p.questId === quest.id);
    if (row?.claimed) continue;
    if (!row) {
      row = { questId: quest.id, counters: {}, claimed: false };
      progress.push(row);
    }
    quest.objectives.forEach((objective, index) => {
      if (
        objective.kind === event.kind &&
        (objective.kind !== "defeat" ||
          (event.kind === "defeat" && objective.enemyId === event.enemyId))
      )
        row!.counters[String(index)] = Math.min(
          objective.quantity,
          (row!.counters[String(index)] ?? 0) + 1,
        );
    });
  }
  character.questProgress = progress;
}
