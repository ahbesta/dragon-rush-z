import { describe, expect, it } from "vitest";
import { combatTimeline } from "@/lib/combat-timeline";
import type { ActiveBattle } from "@/game/types";
import type { BattleFrame } from "@/lib/battle-presentation";

const vitals = { playerHp: 100, enemyHp: 100, playerKi: 40, enemyKi: 40 };
const frame = (
  seq: number,
  actor: "player" | "enemy",
  kind: "strike" | "effect" = "strike",
): BattleFrame => ({
  seq,
  actor,
  kind,
  round: 1,
  before: vitals,
  after: vitals,
  caption: `Move ${seq}`,
});
describe("Combat timeline reflects recorded events and initiative", () => {
  it("follows the server's actual order, retaining repeated actors and effects", () => {
    const frames = [
      frame(2, "enemy"),
      frame(3, "enemy", "effect"),
      frame(5, "player"),
      frame(9, "enemy"),
    ];
    expect(combatTimeline(frames, frames[0], true).map((t) => [t.actor, t.label, t.seq])).toEqual([
      ["enemy", "AGORA", 2],
      ["enemy", "A SEGUIR", 3],
      ["player", "A SEGUIR", 5],
    ]);
    expect(combatTimeline(frames, frames[1], true)[0]).toMatchObject({
      actor: "enemy",
      label: "EFEITO",
      seq: 3,
    });
    expect(combatTimeline(frames, frames.at(-1)!, true)).toHaveLength(1);
  });
  it("shows published initiative only while waiting and never invents future rounds", () => {
    const active = {
      initiative: "enemy",
      intent: { kind: "charge", label: "Concentra Ki" },
    } as ActiveBattle;
    expect(combatTimeline([], null, false, active).map((t) => [t.actor, t.label])).toEqual([
      ["enemy", "1º"],
      ["player", "2º"],
    ]);
    expect(combatTimeline([], null, false, active)[0].caption).toBe("Concentra Ki");
    expect(combatTimeline([], null, false, null)).toEqual([]);
    expect(combatTimeline([], null, false, {} as ActiveBattle)).toEqual([]);
  });
});
