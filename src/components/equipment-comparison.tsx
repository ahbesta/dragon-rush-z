import { deriveBuildStats } from "@/game/attributes";
import type { GameSnapshot, ItemDefinition } from "@/game/types";
import { attributeLabels } from "./game-primitives";
export function EquipmentComparison({
  snapshot,
  item,
}: {
  snapshot: GameSnapshot;
  item: ItemDefinition;
}) {
  if (item.type !== "equipment" || !item.slot) return null;
  const current = snapshot.catalog.items.find(
    (i) => i.id === snapshot.character.equipment[item.slot!],
  );
  const items = Object.entries(snapshot.character.equipment)
    .filter(([slot]) => slot !== item.slot)
    .map(([, id]) => snapshot.catalog.items.find((i) => i.id === id)!)
    .filter(Boolean);
  const next = deriveBuildStats(snapshot.character.base, snapshot.character.level, [
    ...items,
    item,
  ]);
  const deltas = [
    ...Object.entries(attributeLabels).map(([key, label]) => ({
      label,
      delta:
        (next[key as keyof typeof attributeLabels] ?? 0) -
        (snapshot.stats[key as keyof typeof attributeLabels] ?? 0),
    })),
    { label: "HP máximo", delta: next.maxHp - snapshot.stats.maxHp },
    { label: "Ki máximo", delta: next.maxKi - snapshot.stats.maxKi },
    { label: "Power Level", delta: next.powerLevel - snapshot.stats.powerLevel },
    ...(
      [
        ["critical", "Crítico"],
        ["evasion", "Esquiva"],
        ["physicalResistance", "Resistência física"],
        ["statusResistance", "Resistência a efeitos"],
        ["guardBreak", "Quebra de guarda"],
      ] as const
    ).map(([key, label]) => ({
      label: `${label} (%)`,
      delta: Math.round(((next[key] ?? 0) - (snapshot.stats[key] ?? 0)) * 1000) / 10,
    })),
  ].filter((d) => d.delta !== 0);
  return (
    <div className="rpg-equipment-compare">
      <small>Comparado a {current?.name ?? "slot vazio"}</small>
      <div>
        {deltas.map((d) => (
          <span className={d.delta > 0 ? "green-text" : "red-text"} key={d.label}>
            {d.delta > 0 ? "+" : ""}
            {d.delta} {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
