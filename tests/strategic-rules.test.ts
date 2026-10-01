import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { seedCatalog as c } from "@/server/db/seed-data";
import {
  buildAttributes,
  emptyAllocation,
  pointBudget,
  recommendedAllocation,
  respecCost,
  spentPoints,
} from "@/game/builds";
import { deriveBuildStats, calculateBuildPowerLevel } from "@/game/attributes";
import { defeatLoss, itemRecovery, rewardMultiplier, questReady } from "@/game/economy";
import {
  createStrategicCombat,
  advanceStrategicCombat,
  presentStrategicCombat,
} from "@/game/strategic-combat";
import { finishCombat } from "@/game/combat";
import type { CombatState } from "@/game/types";
import { seededRandom, simulateScenario } from "../scripts/balance-report";

function combat(): CombatState {
  const stats = deriveBuildStats(buildAttributes(c.races[0], emptyAllocation()), 1);
  return createStrategicCombat({
    id: randomUUID(),
    player: {
      name: "Teste",
      hp: stats.maxHp,
      ki: stats.maxKi,
      stats,
      techniques: c.techniques.filter((t) => ["soco", "chute", "rogafufuken"].includes(t.id)),
    },
    enemy: { ...c.enemies[1], maxHp: 1000 },
    techniques: c.techniques,
    drops: c.drops,
    random: () => 0.5,
    playerLevel: 1,
    belt: ["pocao-hp", "pocao-ki", "semente-deuses"],
    inventory: [
      { itemId: "pocao-hp", quantity: 5 },
      { itemId: "pocao-ki", quantity: 5 },
      { itemId: "semente-deuses", quantity: 2 },
    ],
    items: c.items,
    autoItems: { enabled: false, hpThreshold: 30, kiThreshold: 20, maxUses: 3 },
  });
}
describe("Builds e economia v2", () => {
  it.each(c.races)("respeita orçamento e afinidades de $name", (race) => {
    const allocation = emptyAllocation();
    allocation.strength = 20;
    const stats = buildAttributes(race, allocation);
    expect(stats.strength).toBe(race.base.strength + Math.floor(20 * race.affinities!.strength));
    expect(spentPoints(recommendedAllocation(race, 17))).toBe(pointBudget(17));
  });
  it("equipamentos não recebem a afinidade da raça e PL usa recursos reais", () => {
    const race = c.races[0],
      base = buildAttributes(race, { ...emptyAllocation(), strength: 4 });
    const gear = c.items.find((i) => i.id === "bastao")!;
    const stats = deriveBuildStats(base, 1, [gear]);
    expect(stats.strength).toBe(base.strength + 4);
    expect(stats.powerLevel).toBe(calculateBuildPowerLevel(stats, stats.maxHp, stats.maxKi));
    expect(calculateBuildPowerLevel(base, 640, 170)).toBeGreaterThan(
      calculateBuildPowerLevel(base, 180, 90),
    );
  });
  it("custo e perda não removem níveis e recompensa obsoleta é reduzida", () => {
    expect(respecCost(10, 0)).toBe(0);
    expect(respecCost(10, 1)).toBe(150);
    expect(defeatLoss(50)).toBe(2);
    expect(defeatLoss(10000)).toBe(100);
    expect([1, 2, 3, 4, 5, 6].map((l) => rewardMultiplier(l, 1))).toEqual([
      1, 1, 1, 0.5, 0.25, 0.1,
    ]);
  });
  it("poções recuperam frações com teto e entregas verificam estoque", () => {
    expect(
      itemRecovery(
        30,
        80,
        180,
        90,
        c.items.find((i) => i.id === "pocao-hp")!,
      ),
    ).toEqual({ hp: 93, ki: 80 });
    const q = c.quests.find((q) => q.id === "treino-kame")!;
    const progress = { questId: q.id, claimed: false, counters: { "0": 3 } };
    expect(questReady(q, progress, [{ itemId: "erva", quantity: 3 }])).toBe(false);
    expect(questReady(q, progress, [{ itemId: "erva", quantity: 4 }])).toBe(true);
  });
  it("catálogo tem referências válidas e campanha sem atalhos de nível", () => {
    expect(c.chapters).toHaveLength(6);
    expect(c.areas.length).toBeGreaterThanOrEqual(15);
    for (const d of c.drops) {
      expect(c.items.some((i) => i.id === d.itemId)).toBe(true);
      expect(d.chance).toBeGreaterThan(0);
      expect(d.chance).toBeLessThanOrEqual(1);
    }
    for (const q of c.quests)
      for (const flag of q.requirements.flags ?? [])
        if (flag.startsWith("quest:"))
          expect(c.quests.some((q) => q.id === flag.slice(6))).toBe(true);
    for (const r of c.recipes) {
      expect(c.items.some((i) => i.id === r.outputItemId)).toBe(true);
      for (const i of r.ingredients) expect(c.items.some((it) => it.id === i.itemId)).toBe(true);
    }
    expect(c.enemies.find((e) => e.id === "piccolo-daimao")!.requirements.flags).toContain(
      "quest:drum",
    );
  });
});
describe("Combate estratégico", () => {
  it.each(c.races)("boss final exige preparo e continua vencível por $name", (race) => {
    const samples = 50;
    let equippedWins = 0,
      bareWins = 0,
      consumables = 0;
    for (let seed = 1; seed <= samples; seed++) {
      const prepared = simulateScenario(race, "piccolo-daimao", 20, true, seed);
      const bare = simulateScenario(race, "piccolo-daimao", 20, false, seed);
      equippedWins += Number(prepared.outcome === "victory");
      bareWins += Number(bare.outcome === "victory");
      consumables += (prepared.usedItems ?? []).reduce((sum, i) => sum + i.quantity, 0);
    }
    expect(equippedWins / samples).toBeGreaterThanOrEqual(0.5);
    expect(bareWins / samples).toBeLessThanOrEqual(0.1);
    expect(consumables / samples).toBeGreaterThan(1);
  });
  it("drop raro mantém a probabilidade do catálogo em dez mil amostras", () => {
    const random = seededRandom(617);
    const rare = c.drops.find((d) => d.chance === 0.02)!;
    let count = 0;
    for (let i = 0; i < 10000; i++) {
      const state = combat();
      state.definition = { ...state.definition, id: rare.enemyId, guaranteedItem: undefined };
      state.drops = [rare];
      state.enemy.hp = 1;
      // Reward generation shares the same seeded RNG as the live engine.
      const result = finishCombat(state, random);
      count += Number(result.drops.some((i) => i.itemId === rare.itemId));
    }
    expect(count / 10000).toBeGreaterThan(0.014);
    expect(count / 10000).toBeLessThan(0.026);
  });
  it("defesa protege toda a rodada mesmo com iniciativa inimiga", () => {
    const s = combat();
    s.strategic!.initiative = "enemy";
    const normal = advanceStrategicCombat(s, { kind: "attack", techniqueId: "soco" }, () => 0.5),
      guard = advanceStrategicCombat(s, { kind: "guard" }, () => 0.5);
    expect(s.player.hp - guard.player.hp).toBeLessThanOrEqual(
      Math.ceil((s.player.hp - normal.player.hp) * 0.5),
    );
    expect(s.round).toBe(0);
  });
  it("carga recupera Ki e deixa vulnerável, sem gerar cura", () => {
    const s = combat();
    s.player.ki = 0;
    const n = advanceStrategicCombat(s, { kind: "attack", techniqueId: "soco" }, () => 0.5),
      charged = advanceStrategicCombat(s, { kind: "charge" }, () => 0.5);
    expect(charged.player.ki).toBe(Math.floor(s.player.stats.maxKi * 0.2));
    expect(charged.player.hp).toBeLessThan(n.player.hp);
  });
  it("itens usam ação, recarga compartilhada e limite de três", () => {
    let s = combat();
    s.player.hp = 50;
    s.enemy.techniques = [];
    s.strategic!.intent = { kind: "guard", label: "Guarda" };
    s.definition.pattern = [{ kind: "guard", label: "Guarda" }];
    s = advanceStrategicCombat(s, { kind: "item", itemId: "pocao-hp" }, () => 0.5);
    expect(s.strategic!.used).toEqual([{ itemId: "pocao-hp", quantity: 1 }]);
    expect(s.events.filter((e) => e.type === "attack")).toHaveLength(0);
    expect(() =>
      advanceStrategicCombat(s, { kind: "item", itemId: "pocao-hp" }, () => 0.5),
    ).toThrow(/recarga/);
    for (let use = 1; use < 3; use++) {
      s = advanceStrategicCombat(s, { kind: "guard" }, () => 0.5);
      s = advanceStrategicCombat(s, { kind: "guard" }, () => 0.5);
      s.player.hp = 20;
      s = advanceStrategicCombat(s, { kind: "item", itemId: "pocao-hp" }, () => 0.5);
    }
    expect(s.strategic!.itemUses).toBe(3);
    s.player.hp = 20;
    for (let i = 0; i < 2; i++) s = advanceStrategicCombat(s, { kind: "guard" }, () => 0.5);
    expect(() =>
      advanceStrategicCombat(s, { kind: "item", itemId: "pocao-hp" }, () => 0.5),
    ).toThrow();
  });
  it("não consome item sem efeito e Senzu só pode ser usada uma vez", () => {
    let s = combat();
    expect(() =>
      advanceStrategicCombat(s, { kind: "item", itemId: "pocao-hp" }, () => 0.5),
    ).toThrow(/preservado/i);
    s.definition.pattern = [{ kind: "guard", label: "Guarda" }];
    s.strategic!.intent = { kind: "guard", label: "Guarda" };
    s.player.hp = 20;
    s = advanceStrategicCombat(s, { kind: "item", itemId: "semente-deuses" }, () => 0.5);
    s.player.hp = 20;
    for (let i = 0; i < 2; i++) s = advanceStrategicCombat(s, { kind: "guard" }, () => 0.5);
    expect(
      presentStrategicCombat(s).consumables!.find((i) => i.itemId === "semente-deuses")!.available,
    ).toBe(false);
  });
  it("paralisia não trava ataques além da rodada prometida", () => {
    let s = combat();
    s.player.statuses = [{ kind: "paralysis", expires: 2 }];
    expect(presentStrategicCombat(s).techniques.every((t) => !t.available)).toBe(true);
    expect(() =>
      advanceStrategicCombat(s, { kind: "attack", techniqueId: "soco" }, () => 0.5),
    ).toThrow(/paralisado/i);
    s = advanceStrategicCombat(s, { kind: "guard" }, () => 0.5);
    expect(presentStrategicCombat(s).techniques.find((t) => t.id === "soco")!.available).toBe(true);
    expect(() =>
      advanceStrategicCombat(s, { kind: "attack", techniqueId: "soco" }, () => 0.5),
    ).not.toThrow();
  });
  it("Rogafufuken interrompe concentração quando age primeiro", () => {
    const s = combat();
    s.strategic!.initiative = "player";
    s.strategic!.intent = { kind: "charge", label: "Carga" };
    const after = advanceStrategicCombat(
      s,
      { kind: "attack", techniqueId: "rogafufuken" },
      () => 0.5,
    );
    expect(after.strategic!.enemyCharging).toBe(false);
    expect(
      after.events.some((e) => e.type === "effect" && e.description.includes("interrompida")),
    ).toBe(true);
  });
  it("automático preserva poções sem autorização", () => {
    const s = combat();
    s.player.hp = 50;
    const result = finishCombat(s, () => 0.5);
    expect(result.usedItems).toEqual([]);
  });
  it("boss garante troféu e Heróico tem dificuldade fixa", () => {
    const s = combat(),
      boss = c.enemies.find((e) => e.id === "yamcha")!;
    s.definition = { ...boss };
    s.enemy.hp = 1;
    s.enemy.stats.maxHp = boss.maxHp;
    const result = advanceStrategicCombat(
      s,
      { kind: "attack", techniqueId: "soco" },
      () => 0.5,
    ).result!;
    expect(result.drops).toContainEqual({ itemId: "trofeu-yamcha", quantity: 1 });
    const heroic = c.enemies.find((e) => e.heroicOf === "yamcha")!;
    expect(heroic.maxHp).toBeGreaterThan(boss.maxHp);
    expect(heroic.requirements.flags).toContain("defeated:yamcha");
  });
});
