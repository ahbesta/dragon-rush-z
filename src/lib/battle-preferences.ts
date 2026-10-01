export const battleSpeedKey = "dragon-rush-z:battle-speed";
export type BattleSpeed = 1 | 2 | 3;

export function parseBattleSpeed(value: string | null): BattleSpeed {
  return value === "2" ? 2 : value === "3" ? 3 : 1;
}

export function nextBattleSpeed(speed: BattleSpeed): BattleSpeed {
  return speed === 3 ? 1 : speed === 2 ? 3 : 2;
}
