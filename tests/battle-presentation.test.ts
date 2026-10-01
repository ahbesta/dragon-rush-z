import { describe, expect, it } from "vitest";
import { presentBattleEvents } from "@/lib/battle-presentation";
import { createCombat, simulateBattle } from "@/game/combat";
import { deriveStats } from "@/game/attributes";
import type { BattleEvent } from "@/game/types";
import { seedCatalog as catalog } from "@/server/db/seed-data";

const fallback = {
  playerHp: 160,
  playerKi: 60,
  enemyHp: 80,
  enemyKi: 0,
  playerMaxHp: 300,
  playerMaxKi: 150,
  enemyMaxHp: 100,
  enemyMaxKi: 20,
};
const start: BattleEvent = {
  seq: 0,
  round: 0,
  type: "start",
  player: "Guerreiro",
  enemy: "Bandido",
  playerHp: 180,
  enemyHp: 100,
  playerKi: 90,
  enemyKi: 20,
  playerMaxHp: 180,
  playerMaxKi: 90,
  enemyMaxHp: 100,
  enemyMaxKi: 20,
};
const strike: BattleEvent[] = [
  {
    seq: 1,
    round: 1,
    type: "skill",
    actor: "player",
    techniqueId: "rajada-ki",
    kiCost: 12,
    remainingKi: 78,
  },
  {
    seq: 2,
    round: 1,
    type: "attack",
    actor: "player",
    target: "enemy",
    techniqueId: "rajada-ki",
    techniqueName: "Rajada de Ki",
  },
  {
    seq: 3,
    round: 1,
    type: "damage",
    actor: "player",
    target: "enemy",
    amount: 37,
    remainingHp: 63,
  },
];
describe("Apresentação da batalha", () => {
  it("preserva máximos da luta mesmo quando o personagem sobe de nível depois", () => {
    const view = presentBattleEvents([start, ...strike], catalog.techniques, fallback);
    expect(view.initial).toEqual({ playerHp: 180, playerKi: 90, enemyHp: 100, enemyKi: 20 });
    expect(view.maximum).toEqual(view.initial);
    expect(view.final).toEqual({ playerHp: 180, playerKi: 78, enemyHp: 63, enemyKi: 20 });
  });
  it("agrupa ataque e dano em um quadro, usando os valores enviados pelo servidor", () => {
    const events = [start, ...strike];
    const copy = structuredClone(events);
    const view = presentBattleEvents(events, catalog.techniques, fallback);
    expect(view.frames).toHaveLength(1);
    expect(view.frames[0]).toMatchObject({
      seq: 3,
      round: 1,
      kind: "strike",
      techniqueId: "rajada-ki",
      ki: true,
      damage: 37,
      before: { enemyHp: 100 },
      after: { enemyHp: 63 },
    });
    expect(events).toEqual(copy);
  });
  it("apresenta regeneração pelo HP numérico sem interpretar a descrição", () => {
    const events: BattleEvent[] = [
      start,
      ...strike,
      {
        seq: 4,
        round: 1,
        type: "effect",
        actor: "enemy",
        description: "Regeneração",
        remainingHp: 76,
      },
    ];
    const view = presentBattleEvents(events, catalog.techniques, fallback);
    expect(view.frames.at(-1)).toMatchObject({
      kind: "effect",
      before: { enemyHp: 63 },
      after: { enemyHp: 76 },
    });
    expect(view.final.enemyHp).toBe(76);
  });
  it("consegue reproduzir logs antigos sem os novos campos de recursos", () => {
    const legacy: BattleEvent = {
      seq: 0,
      round: 0,
      type: "start",
      player: "Guerreiro",
      enemy: "Bandido",
      playerHp: 180,
      enemyHp: 100,
    };
    const view = presentBattleEvents([legacy, ...strike], catalog.techniques, {
      ...fallback,
      playerKi: 78,
    });
    expect(view.initial.playerKi).toBe(90);
    expect(view.final.enemyHp).toBe(63);
    expect(view.maximum.playerHp).toBe(300);
  });
  it("mantém a fase do boss e encerra sem recalcular recompensas", () => {
    const events: BattleEvent[] = [
      start,
      { seq: 1, round: 1, type: "phase", name: "Fúria do Rei Demônio" },
      { seq: 2, round: 2, type: "end", outcome: "victory" },
      { seq: 3, round: 2, type: "reward", xp: 350, zeni: 90, drops: [] },
    ];
    const view = presentBattleEvents(events, catalog.techniques, fallback);
    expect(view.frames).toHaveLength(2);
    expect(view.frames.at(-1)).toMatchObject({
      kind: "end",
      phase: "Fúria do Rei Demônio",
      outcome: "victory",
    });
    expect(view.final).toEqual(view.initial);
  });
  it("recupera o Ki inicial do inimigo de logs antigos pela última habilidade", () => {
    const legacy: BattleEvent = {
      seq: 0,
      round: 0,
      type: "start",
      player: "Guerreiro",
      enemy: "Saibaman",
      playerHp: 180,
      enemyHp: 170,
    };
    const skills: BattleEvent[] = [
      {
        seq: 1,
        round: 1,
        type: "skill",
        actor: "enemy",
        techniqueId: "rajada-ki",
        kiCost: 15,
        remainingKi: 25,
      },
      {
        seq: 2,
        round: 2,
        type: "skill",
        actor: "enemy",
        techniqueId: "rajada-ki",
        kiCost: 15,
        remainingKi: 10,
      },
    ];
    const view = presentBattleEvents([legacy, ...skills], catalog.techniques, {
      ...fallback,
      enemyMaxKi: 40,
    });
    expect(view.initial.enemyKi).toBe(40);
    expect(view.final.enemyKi).toBe(10);
  });
  it("o motor fornece os recursos iniciais e preserva a área no resultado", () => {
    const stats = deriveStats(catalog.races[0].base, 1);
    const input = {
      id: "test-arena",
      areaId: "floresta",
      player: {
        name: "Guerreiro",
        hp: 160,
        ki: 80,
        stats,
        techniques: catalog.techniques.filter((t) => t.id === "soco"),
      },
      enemy: catalog.enemies[0],
      techniques: catalog.techniques,
      drops: catalog.drops,
      random: () => 0.5,
    };
    const state = createCombat(input);
    expect(state.areaId).toBe("floresta");
    expect(state.events[0]).toMatchObject({
      playerHp: 160,
      playerKi: 80,
      playerMaxHp: stats.maxHp,
      playerMaxKi: stats.maxKi,
      enemyMaxHp: input.enemy.maxHp,
    });
    const result = simulateBattle(input);
    expect(result.areaId).toBe("floresta");
    const view = presentBattleEvents(result.events, catalog.techniques, fallback);
    expect(view.final.playerHp).toBe(result.playerHp);
    expect(view.final.playerKi).toBe(result.playerKi);
  });
});
