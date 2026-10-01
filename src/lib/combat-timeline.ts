import type { ActiveBattle } from "@/game/types";
import type { BattleFrame } from "./battle-presentation";

export type TimelineTurn = {
  actor: "player" | "enemy";
  label: string;
  caption: string;
  seq?: number;
};

// Playback uses the server's recorded sequence; waiting battles use its published initiative.
export function combatTimeline(
  frames: BattleFrame[],
  current: BattleFrame | null,
  playing: boolean,
  active?: ActiveBattle | null,
): TimelineTurn[] {
  if (playing && current) {
    const actions = frames.filter((f) => f.actor && f.seq >= current.seq);
    return actions.slice(0, 3).map((f, i) => ({
      actor: f.actor!,
      label:
        i === 0 && f.seq === current.seq ? (f.kind === "strike" ? "AGORA" : "EFEITO") : "A SEGUIR",
      caption: f.caption,
      seq: f.seq,
    }));
  }
  if (active?.initiative) {
    const first = active.initiative;
    return [first, first === "player" ? ("enemy" as const) : ("player" as const)].map(
      (actor, i) => ({
        actor,
        label: i === 0 ? "1º" : "2º",
        caption:
          actor === "enemy" ? (active.intent?.label ?? "Ação do inimigo") : "Escolha sua ação",
      }),
    );
  }
  return [];
}
