import type { ItemDefinition, Rarity } from "@/game/types";

const rarityOrder: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3 };

export function sortItemsByRarity<T extends { itemId: string }>(
  entries: readonly T[],
  catalog: readonly Pick<ItemDefinition, "id" | "rarity">[],
): T[] {
  const priorities = new Map(catalog.map((item) => [item.id, rarityOrder[item.rarity]]));
  return [...entries].sort(
    (a, b) => (priorities.get(b.itemId) ?? 0) - (priorities.get(a.itemId) ?? 0),
  );
}
