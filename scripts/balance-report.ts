import { mkdir, writeFile } from "node:fs/promises";
import { seedCatalog as catalog } from "../src/server/db/seed-data";
import { emptyAllocation, buildAttributes, pointBudget } from "../src/game/builds";
import { deriveBuildStats } from "../src/game/attributes";
import {
  createStrategicCombat,
  advanceStrategicCombat,
  presentStrategicCombat,
} from "../src/game/strategic-combat";
import type { CombatCommand, RaceDefinition } from "../src/game/types";

export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
export function simulateScenario(
  race: RaceDefinition,
  enemyId: string,
  level: number,
  prepared: boolean,
  seed: number,
  manual = true,
) {
  const enemy = catalog.enemies.find((e) => e.id === enemyId)!;
  const allocation = emptyAllocation();
  const kiBuild = race.id === "freeza" || race.id === "namekuseijin";
  const weights = kiBuild
    ? ["kiControl", "endurance", "kiControl", "defense", "speed"]
    : ["strength", "endurance", "strength", "defense", "kiControl"];
  for (let p = 0; p < pointBudget(level); p++)
    allocation[weights[p % weights.length] as keyof typeof allocation]++;
  const gear = prepared
    ? catalog.items.filter(
        (i) =>
          ["bastao", "armadura-simples", "botas-leves", "faixa-foco"].includes(i.id) ||
          (level >= 5 && ["gi-kame", "luvas-combate"].includes(i.id)) ||
          (level >= 10 && i.id === "bastao-magico") ||
          (level >= 12 && i.id === "botas-karin") ||
          (level >= 17 && i.id === "faixa-mestre"),
      )
    : [];
  // Exactly one equipment per slot.
  const equipment = Array.from(new Map(gear.map((i) => [i.slot, i])).values());
  const stats = deriveBuildStats(buildAttributes(race, allocation), level, equipment);
  const tech = catalog.techniques.filter((t) =>
    level >= 5
      ? ["kamehameha", "rajada-ki", "chute"].includes(t.id)
      : level >= 2
        ? ["rajada-ki", "chute"].includes(t.id)
        : t.id === "chute",
  );
  const hpItem = level < 5 ? "pocao-hp" : "pocao-hp-forte",
    kiItem = level < 5 ? "pocao-ki" : "pocao-ki-forte";
  const random = seededRandom(seed);
  let s = createStrategicCombat({
    id: "00000000-0000-4000-8000-000000000001",
    player: { name: "Simulação", hp: stats.maxHp, ki: stats.maxKi, stats, techniques: tech },
    enemy,
    techniques: catalog.techniques,
    drops: catalog.drops,
    random,
    playerLevel: level,
    belt: [hpItem, kiItem],
    inventory: prepared
      ? [
          { itemId: hpItem, quantity: 3 },
          { itemId: kiItem, quantity: 1 },
        ]
      : [],
    items: catalog.items,
    autoItems: { enabled: prepared, hpThreshold: 50, kiThreshold: 20, maxUses: 3 },
  });
  while (!s.result) {
    const p = presentStrategicCombat(s);
    let command: CombatCommand | undefined;
    if (manual) {
      const heal = p.consumables!.find((i) => i.itemId === hpItem && i.available);
      const ki = p.consumables!.find((i) => i.itemId === kiItem && i.available);
      const skill = p.techniques.find((t) => t.available && t.id !== "soco");
      if (heal && s.player.hp / stats.maxHp < 0.6) command = { kind: "item", itemId: heal.itemId };
      else if (ki && s.player.ki / stats.maxKi < 0.2) command = { kind: "item", itemId: ki.itemId };
      else if (
        p.intent?.kind === "attack" &&
        (p.intent.multiplier ?? 1) *
          (catalog.techniques.find((t) => t.id === p.intent?.techniqueId)?.multiplier ?? 1) >=
          2.5
      )
        command = { kind: "guard" };
      else if (p.intent?.kind === "guard" && s.player.ki < stats.maxKi * 0.4)
        command = { kind: "charge" };
      else command = { kind: "attack", techniqueId: skill?.id ?? "soco" };
      if (
        s.player.statuses?.some(
          (status) => status.kind === "paralysis" && status.expires > s.player.turns + 1,
        ) &&
        command.kind === "attack"
      )
        command = { kind: "guard" };
    }
    s = advanceStrategicCombat(s, command, random);
  }
  return { ...s.result, rounds: s.round, maxHp: stats.maxHp };
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/balance-report.ts")) {
  const report = [];
  const samples = Number(process.env.BALANCE_SAMPLES ?? 200);
  for (const enemyId of [
    "lobo",
    "yamcha",
    "jackie-chun",
    "general-blue",
    "tao-pai-pai",
    "tenshinhan",
    "piccolo-daimao",
  ]) {
    const enemy = catalog.enemies.find((e) => e.id === enemyId)!;
    for (const race of catalog.races)
      for (const prepared of [false, true]) {
        let wins = 0,
          hp = 0,
          rounds = 0,
          items = 0;
        for (let seed = 1; seed <= samples; seed++) {
          const result = simulateScenario(race, enemyId, enemy.level, prepared, seed);
          if (result.outcome === "victory") wins++;
          hp += result.playerHp / result.maxHp;
          rounds += result.rounds;
          items += (result.usedItems ?? []).reduce((n, i) => n + i.quantity, 0);
        }
        report.push({
          enemy: enemy.name,
          race: race.name,
          level: enemy.level,
          prepared,
          samples,
          winRate: wins / samples,
          remainingHp: Math.round((hp / samples) * 100),
          rounds: Math.round((rounds / samples) * 10) / 10,
          items: Math.round((items / samples) * 10) / 10,
        });
      }
  }
  await mkdir("docs", { recursive: true });
  await writeFile("docs/balance-report.json", JSON.stringify(report, null, 2));
  console.table(
    report.map(({ enemy, race, prepared, winRate, remainingHp, rounds, items }) => ({
      enemy,
      race,
      prepared,
      winRate,
      remainingHp,
      rounds,
      items,
    })),
  );
}
