import type { EnemyDefinition } from "./types";

// Defeat flags are awarded only when the server commits a victory.
// Each heroic variant requires its own first clear.
export function requiresManualCombat(
  enemy: Pick<EnemyDefinition, "id" | "boss">,
  flags: readonly string[],
): boolean {
  return enemy.boss && !flags.includes(`defeated:${enemy.id}`);
}
