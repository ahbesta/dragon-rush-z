import { describe, expect, it } from "vitest";
import { requiresManualCombat } from "@/game/combat-access";
import { nextBattleSpeed, parseBattleSpeed } from "@/lib/battle-preferences";

describe("First boss clear and animation preferences", () => {
  it("requires a victory against the exact boss, including heroic variants", () => {
    expect(requiresManualCombat({ id: "yamcha", boss: true }, [])).toBe(true);
    expect(requiresManualCombat({ id: "yamcha", boss: true }, ["defeated:pilaf"])).toBe(true);
    expect(requiresManualCombat({ id: "yamcha", boss: true }, ["defeated:yamcha"])).toBe(false);
    expect(requiresManualCombat({ id: "yamcha-heroico", boss: true }, ["defeated:yamcha"])).toBe(
      true,
    );
    expect(
      requiresManualCombat({ id: "yamcha-heroico", boss: true }, ["defeated:yamcha-heroico"]),
    ).toBe(false);
    expect(requiresManualCombat({ id: "lobo", boss: false }, [])).toBe(false);
  });
  it("accepts only supported animation speeds and safely resets invalid preferences", () => {
    for (const value of [null, "", "0", "4", "-1", "2x", "NaN", "999999"]) {
      expect(parseBattleSpeed(value)).toBe(1);
    }
    expect(["1", "2", "3"].map(parseBattleSpeed)).toEqual([1, 2, 3]);
    expect([1, 2, 3].map((speed) => nextBattleSpeed(speed as 1 | 2 | 3))).toEqual([2, 3, 1]);
  });
});
