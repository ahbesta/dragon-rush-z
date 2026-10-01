import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  advanceCombat,
  createCombat,
  finishCombat,
  presentCombat,
  simulateBattle,
  type CombatInput,
} from "@/game/combat";
import { deriveStats } from "@/game/attributes";
import { actionInput } from "@/game/validation";
import { legacyCatalog as c } from "@/server/db/legacy-catalog";
const punch = c.techniques.find((t) => t.id === "soco")!;
const kick = c.techniques.find((t) => t.id === "chute")!;
const blast = c.techniques.find((t) => t.id === "rajada-ki")!;
function input(overrides: Partial<CombatInput> = {}): CombatInput {
  return {
    id: randomUUID(),
    player: {
      name: "Guerreiro",
      hp: 500,
      ki: 100,
      stats: { ...deriveStats(c.races[0].base, 1), maxHp: 500 },
      techniques: [blast, kick, punch],
    },
    enemy: { ...c.enemies[1], maxHp: 300 },
    techniques: c.techniques,
    drops: c.drops,
    random: () => 0.5,
    ...overrides,
  };
}
describe("Combate manual e motor compartilhado", () => {
  it("preserva a duração de buffs entre rodadas e remove o efeito ao expirar", () => {
    const buff = {
      ...punch,
      id: "buff",
      cooldown: 10,
      effects: [{ kind: "buff" as const, attribute: "strength" as const, amount: 5, turns: 1 }],
    };
    const fixture = input();
    fixture.enemy.maxHp = 1000;
    fixture.player.techniques = [buff, punch];
    fixture.techniques = [...c.techniques, buff];
    const initial = createCombat(fixture);
    const first = advanceCombat(initial, "buff", () => 0.5);
    expect(first.player.stats.strength).toBe(initial.player.stats.strength + 5);
    const second = advanceCombat(JSON.parse(JSON.stringify(first)), "soco", () => 0.5);
    expect(second.player.stats.strength).toBe(initial.player.stats.strength + 5);
    const third = advanceCombat(JSON.parse(JSON.stringify(second)), "soco", () => 0.5);
    expect(third.player.stats.strength).toBe(initial.player.stats.strength);
    expect(third.player.buffs).toEqual([]);
  });
  it("inicia sem atacar ou sortear recompensas", () => {
    const state = createCombat(input());
    expect(state.round).toBe(0);
    expect(state.result).toBeNull();
    expect(state.events.map((e) => e.type)).toEqual(["start"]);
  });
  it("resolve somente uma rodada com a técnica escolhida", () => {
    const initial = createCombat(input());
    const next = advanceCombat(initial, "soco", () => 0.5);
    expect(next.round).toBe(1);
    expect(next.result).toBeNull();
    const attacks = next.events.filter((e) => e.type === "attack");
    expect(attacks).toHaveLength(2);
    expect(attacks.find((e) => e.type === "attack" && e.actor === "player")).toMatchObject({
      techniqueId: "soco",
    });
    expect(initial.round).toBe(0);
    expect(initial.enemy.hp).toBe(300);
  });
  it("rejeita técnica não disponível sem consumir a rodada", () => {
    const state = createCombat(input());
    expect(() => advanceCombat(state, "kamehameha", () => 0)).toThrow(
      expect.objectContaining({ code: "TECHNIQUE_LOCKED" }),
    );
    expect(state.events).toHaveLength(1);
  });
  it("rejeita falta de Ki; Soco continua disponível", () => {
    const state = createCombat(input());
    state.player.ki = 5;
    expect(() => advanceCombat(state, "rajada-ki", () => 0)).toThrow(
      expect.objectContaining({ code: "NO_KI" }),
    );
    expect(presentCombat(state).techniques.find((t) => t.id === "soco")?.available).toBe(true);
  });
  it("preserva Ki, recargas e efeitos ao serializar entre requisições", () => {
    const first = advanceCombat(createCombat(input()), "rajada-ki", () => 0.5);
    const saved = JSON.parse(JSON.stringify(first));
    expect(saved.player.ki).toBe(85);
    expect(presentCombat(saved).techniques.find((t) => t.id === "rajada-ki")).toMatchObject({
      available: false,
      cooldownRemaining: 1,
    });
    expect(() => advanceCombat(saved, "rajada-ki", () => 0)).toThrow(
      expect.objectContaining({ code: "TECHNIQUE_COOLDOWN" }),
    );
    const second = advanceCombat(saved, "soco", () => 0.5);
    expect(presentCombat(second).techniques.find((t) => t.id === "rajada-ki")?.available).toBe(
      true,
    );
  });
  it("manual e automático produzem o mesmo resultado com as mesmas escolhas", () => {
    const fixture = input();
    let state = createCombat(fixture);
    while (!state.result) {
      const technique =
        state.player.techniques.find(
          (t) =>
            t.kiCost <= state.player.ki &&
            (state.player.nextUse[t.id] ?? 0) <= state.player.turns + 1,
        ) ?? punch;
      state = advanceCombat(state, technique.id, fixture.random);
    }
    expect(state.result).toEqual(simulateBattle(fixture));
  });
  it("assume o automático sem reiniciar a batalha", () => {
    const fixture = input();
    const first = advanceCombat(createCombat(fixture), "soco", fixture.random);
    const result = finishCombat(JSON.parse(JSON.stringify(first)), fixture.random);
    expect(result.events.slice(0, first.events.length)).toEqual(first.events);
    expect(result.outcome).toBe("victory");
    expect(result.events.filter((e) => e.type === "start")).toHaveLength(1);
    expect(result.events.filter((e) => e.type === "reward")).toHaveLength(1);
  });
  it("inimigo mais rápido pode vencer antes do golpe escolhido", () => {
    const state = createCombat(input());
    state.player.hp = 1;
    state.player.stats.speed = 0;
    const next = advanceCombat(state, "rajada-ki", () => 0);
    expect(next.result?.outcome).toBe("defeat");
    expect(next.player.ki).toBe(100);
    expect(next.result).toMatchObject({ xp: 0, zeni: 0, drops: [] });
  });
  it("não permite novo turno após finalizar nem sorteia drops novamente", () => {
    let state = createCombat(input({ enemy: { ...c.enemies[0], maxHp: 1 } }));
    state = advanceCombat(state, "soco", () => 0);
    expect(() => advanceCombat(state, "soco", () => 0)).toThrow(
      expect.objectContaining({ code: "BATTLE_FINISHED" }),
    );
    expect(
      finishCombat(state, () => {
        throw new Error("Não deve sortear novamente");
      }),
    ).toEqual(state.result);
  });
  it("não expõe o estado privado do motor na projeção para o cliente", () => {
    const active = presentCombat(createCombat(input()));
    expect(active).not.toHaveProperty("definition");
    expect(active).not.toHaveProperty("drops");
    expect(active).not.toHaveProperty("fallback");
    expect(active).not.toHaveProperty("player");
  });
  it("valida modo, rodada e comandos sem aceitar HP ou recompensas", () => {
    const key = { idempotencyKey: randomUUID() };
    expect(actionInput.safeParse({ ...key, action: "combat.mode", mode: "turbo" }).success).toBe(
      false,
    );
    const turn = {
      ...key,
      action: "battle.turn",
      battleId: randomUUID(),
      round: 1,
      techniqueId: "soco",
    };
    expect(actionInput.safeParse(turn).success).toBe(true);
    for (const extra of [
      { round: 0 },
      { round: 61 },
      { round: 1.5 },
      { xp: 999999 },
      { hp: 999999 },
      { damage: 999999 },
    ])
      expect(actionInput.safeParse({ ...turn, ...extra }).success).toBe(false);
  });
});
