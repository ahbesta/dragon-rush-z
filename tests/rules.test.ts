import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { deriveStats, calculatePowerLevel } from "@/game/attributes";
import { xpRequired, applyExperience } from "@/game/progression";
import { unmetRequirements } from "@/game/requirements";
import { calculateDamage, simulateBattle, type CombatInput } from "@/game/combat";
import { characterInput, actionInput } from "@/game/validation";
import { seedCatalog as c } from "@/server/db/seed-data";
const race = c.races[0];
function battle(overrides: Partial<CombatInput> = {}) {
  return simulateBattle({
    id: randomUUID(),
    player: {
      name: "Teste",
      hp: 180,
      ki: 90,
      stats: deriveStats(race.base, 1),
      techniques: c.techniques.filter((t) => ["chute", "soco"].includes(t.id)),
    },
    enemy: c.enemies[0],
    techniques: c.techniques,
    drops: c.drops,
    random: () => 0.5,
    ...overrides,
  });
}
describe("Progressão e atributos", () => {
  it("centraliza XP necessária e preserva excedente", () => {
    expect(xpRequired(1)).toBe(100);
    const p = applyExperience(1, 90, 30, race.base, race);
    expect(p.level).toBe(2);
    expect(p.xp).toBe(20);
    expect(p.base.strength).toBe(15);
  });
  it("processa vários níveis em uma recompensa", () => {
    const p = applyExperience(1, 0, 500, race.base, race);
    expect(p.level).toBe(4);
    expect(p.xp).toBe(50);
    expect(p.base.endurance).toBe(16);
  });
  it("não muta atributos originais e rejeita XP negativa", () => {
    const base = { ...race.base };
    applyExperience(1, 0, 100, base, race);
    expect(base).toEqual(race.base);
    expect(() => applyExperience(1, 0, -1, base, race)).toThrow();
  });
  it("calcula Power Level pelos atributos e recursos máximos", () => {
    const stats = deriveStats(race.base, 1);
    expect(stats.maxHp).toBe(180);
    expect(stats.maxKi).toBe(90);
    expect(stats.powerLevel).toBe(185);
    expect(calculatePowerLevel(race.base, 180, 90)).toBe(185);
  });
  it("equipamentos alteram atributos e Power Level sem duplicar bônus", () => {
    const naked = deriveStats(race.base, 1);
    const armor = c.items.find((i) => i.id === "armadura-saiyajin")!;
    const stats = deriveStats(race.base, 1, [armor]);
    expect(stats.defense).toBe(naked.defense + 10);
    expect(stats.endurance).toBe(naked.endurance + 5);
    expect(stats.maxHp).toBe(naked.maxHp + 50);
    expect(stats.powerLevel).toBeGreaterThan(naked.powerLevel);
    expect(deriveStats(race.base, 1)).toEqual(naked);
  });
  it.each(c.races)("$name cresce de acordo com seu catálogo", (r) => {
    const p = applyExperience(1, 0, 100, r.base, r);
    expect(p.base.speed).toBe(r.base.speed + r.growth.speed);
  });
});
describe("Requisitos e validação", () => {
  const context = { level: 10, powerLevel: 1000, raceId: "saiyajin", flags: ["master:kame"] };
  it("verifica nível, poder, raça, mestre e conquistas em conjunto", () => {
    expect(
      unmetRequirements(
        {
          minLevel: 20,
          minPower: 2000,
          raceIds: ["humano"],
          masterId: "vegeta",
          flags: ["saiyan-breakthrough"],
        },
        context,
      ),
    ).toHaveLength(5);
    expect(unmetRequirements({ minLevel: 5, masterId: "kame" }, context)).toEqual([]);
  });
  it("não desbloqueia Super Saiyajin apenas por nível", () => {
    const ssj = c.transformations.find((t) => t.id === "super-saiyajin")!;
    expect(
      unmetRequirements(ssj.requirements, { ...context, level: 99, powerLevel: 99999 }),
    ).toHaveLength(1);
  });
  it("rejeita recompensas e identificadores de terceiros no payload", () => {
    expect(
      actionInput.safeParse({ action: "training.start", xp: 9999, idempotencyKey: randomUUID() })
        .success,
    ).toBe(false);
    expect(
      actionInput.safeParse({
        action: "explore",
        areaId: "floresta",
        userId: "another",
        idempotencyKey: randomUUID(),
      }).success,
    ).toBe(false);
  });
  it("rejeita nomes inválidos e técnicas repetidas", () => {
    expect(
      characterInput.safeParse({
        name: "<script>",
        raceId: "saiyajin",
        idempotencyKey: randomUUID(),
      }).success,
    ).toBe(false);
    expect(
      actionInput.safeParse({
        action: "technique.select",
        techniqueIds: ["soco", "soco"],
        idempotencyKey: randomUUID(),
      }).success,
    ).toBe(false);
  });
  it("aceita nome português e limpa espaços externos", () => {
    expect(
      characterInput.parse({ name: "  João  ", raceId: "humano", idempotencyKey: randomUUID() })
        .name,
    ).toBe("João");
  });
});
describe("Motor de combate", () => {
  it("resolve vitória e concede somente dados do catálogo", () => {
    const b = battle();
    expect(b.outcome).toBe("victory");
    expect(b.xp).toBe(25);
    expect(b.zeni).toBe(10);
    expect(b.playerHp).toBeGreaterThan(0);
    expect(b.events.map((e) => e.seq)).toEqual(b.events.map((_, i) => i));
    expect(b.events[0].type).toBe("start");
    expect(b.events.at(-1)?.type).toBe("end");
  });
  it("atribui iniciativa ao personagem mais veloz", () => {
    const b = battle();
    const attack = b.events.find((e) => e.type === "attack");
    expect(attack?.type === "attack" && attack.actor).toBe("player");
  });
  it("usa Soco quando não há Ki", () => {
    const b = battle({
      player: {
        name: "Teste",
        hp: 180,
        ki: 0,
        stats: deriveStats(race.base, 1),
        techniques: [c.techniques.find((t) => t.id === "rajada-ki")!],
      },
    });
    expect(b.events.some((e) => e.type === "skill")).toBe(false);
    expect(
      b.events
        .filter((e) => e.type === "attack" && e.actor === "player")
        .every((e) => e.type === "attack" && e.techniqueId === "soco"),
    ).toBe(true);
  });
  it("gasta Ki e respeita cooldown por turno do atacante", () => {
    const b = battle({
      enemy: { ...c.enemies[2], maxHp: 200 },
      player: {
        name: "Teste",
        hp: 500,
        ki: 100,
        stats: { ...deriveStats(race.base, 1), maxHp: 500 },
        techniques: [c.techniques.find((t) => t.id === "rajada-ki")!, c.techniques[0]],
      },
    });
    const attacks = b.events.filter((e) => e.type === "attack" && e.actor === "player");
    expect(attacks[0].type === "attack" && attacks[0].techniqueId).toBe("rajada-ki");
    expect(attacks[1].type === "attack" && attacks[1].techniqueId).toBe("soco");
    expect(b.playerKi).toBeLessThan(100);
  });
  it("garante dano mínimo contra defesa extrema", () => {
    const a = deriveStats(race.base, 1);
    expect(calculateDamage(a, { ...a, defense: 99999 }, c.techniques[0], 0.5)).toBe(1);
  });
  it("derrota não concede XP, Zeni ou drops", () => {
    const b = battle({
      player: {
        name: "Teste",
        hp: 1,
        ki: 0,
        stats: { ...deriveStats(race.base, 1), speed: 0 },
        techniques: [c.techniques[0]],
      },
      random: () => 0,
    });
    expect(b.outcome).toBe("defeat");
    expect(b.xp).toBe(0);
    expect(b.zeni).toBe(0);
    expect(b.drops).toEqual([]);
  });
  it("encerra imediatamente após um golpe fatal", () => {
    const b = battle({ enemy: { ...c.enemies[0], maxHp: 1 } });
    expect(b.events.some((e) => e.type === "attack" && e.actor === "enemy")).toBe(false);
  });
  it("limita batalhas intermináveis e não recompensa empate", () => {
    const b = battle({
      enemy: {
        ...c.enemies[0],
        attributes: { strength: 1, defense: 9999, speed: 1, endurance: 1 },
        maxHp: 9999,
      },
      player: {
        name: "Teste",
        hp: 9999,
        ki: 0,
        stats: { ...deriveStats(race.base, 1), strength: 1, defense: 9999 },
        techniques: [c.techniques[0]],
      },
    });
    expect(b.outcome).toBe("draw");
    expect(b.xp).toBe(0);
    expect(b.events.at(-1)?.round).toBe(60);
  });
  it("gera fase do boss e drops garantidos", () => {
    const b = battle({
      enemy: c.enemies.find((e) => e.boss)!,
      player: {
        name: "Teste",
        hp: 2000,
        ki: 200,
        stats: {
          ...deriveStats({ strength: 50, defense: 60, speed: 30, endurance: 100 }, 6),
          maxHp: 2000,
        },
        techniques: [c.techniques[2], c.techniques[0]],
      },
      random: () => 0,
    });
    expect(b.outcome).toBe("victory");
    expect(b.events.some((e) => e.type === "phase")).toBe(true);
    expect(b.drops.some((d) => d.itemId === "semente-deuses")).toBe(true);
  });
});
