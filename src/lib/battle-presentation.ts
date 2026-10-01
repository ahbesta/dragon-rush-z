import type { BattleEvent, BattleResult, TechniqueDefinition } from "@/game/types";

export type BattleVitals = { playerHp: number; playerKi: number; enemyHp: number; enemyKi: number };
export type BattleFrame = {
  seq: number;
  round: number;
  kind: "strike" | "phase" | "effect" | "end";
  before: BattleVitals;
  after: BattleVitals;
  actor?: "player" | "enemy";
  target?: "player" | "enemy";
  techniqueId?: string;
  techniqueName?: string;
  ki?: boolean;
  damage?: number;
  caption: string;
  phase?: string;
  outcome?: BattleResult["outcome"];
};
export type BattlePresentation = {
  initial: BattleVitals;
  final: BattleVitals;
  maximum: BattleVitals;
  frames: BattleFrame[];
};
// Tradução visual dos eventos calculados no servidor. Não calcula dano ou recompensa.
export function presentBattleEvents(
  events: BattleEvent[],
  techniques: TechniqueDefinition[],
  fallback: BattleVitals & {
    playerMaxHp: number;
    playerMaxKi: number;
    enemyMaxHp: number;
    enemyMaxKi: number;
  },
): BattlePresentation {
  const start = events.find((event) => event.type === "start");
  const spent = (actor: "player" | "enemy") =>
    events.reduce(
      (total, event) =>
        total + (event.type === "skill" && event.actor === actor ? event.kiCost : 0),
      0,
    );
  const initialKi = (actor: "player" | "enemy") => {
    const lastSkill = events
      .filter((event) => event.type === "skill" && event.actor === actor)
      .at(-1);
    const finalKi =
      lastSkill?.type === "skill"
        ? lastSkill.remainingKi
        : actor === "player"
          ? fallback.playerKi
          : fallback.enemyMaxKi;
    return finalKi + spent(actor);
  };
  const initial: BattleVitals = {
    playerHp: start?.playerHp ?? fallback.playerHp,
    enemyHp: start?.enemyHp ?? fallback.enemyMaxHp,
    playerKi: start?.playerKi ?? initialKi("player"),
    enemyKi: start?.enemyKi ?? initialKi("enemy"),
  };
  const maximum: BattleVitals = {
    playerHp: start?.playerMaxHp ?? Math.max(fallback.playerMaxHp, initial.playerHp),
    playerKi: start?.playerMaxKi ?? Math.max(fallback.playerMaxKi, initial.playerKi),
    enemyHp: start?.enemyMaxHp ?? Math.max(fallback.enemyMaxHp, initial.enemyHp),
    enemyKi: start?.enemyMaxKi ?? Math.max(fallback.enemyMaxKi, initial.enemyKi),
  };
  let vitals = { ...initial };
  let pending: Extract<BattleEvent, { type: "attack" }> | undefined;
  let beforeAttack = { ...initial };
  let phase: string | undefined;
  const frames: BattleFrame[] = [];
  const names = { player: start?.player ?? "Guerreiro", enemy: start?.enemy ?? "Inimigo" };
  for (const event of events) {
    if (event.type === "skill") {
      vitals = {
        ...vitals,
        [event.actor === "player" ? "playerKi" : "enemyKi"]: event.remainingKi,
      };
    } else if (event.type === "attack") {
      pending = event;
      beforeAttack = { ...vitals };
    } else if (event.type === "damage") {
      const before = pending ? beforeAttack : { ...vitals };
      vitals = {
        ...vitals,
        [event.target === "player" ? "playerHp" : "enemyHp"]: event.remainingHp,
      };
      frames.push({
        seq: event.seq,
        round: event.round,
        kind: "strike",
        before,
        after: { ...vitals },
        actor: event.actor,
        target: event.target,
        damage: event.amount,
        techniqueId: pending?.techniqueId,
        techniqueName: pending?.techniqueName,
        ki: techniques.find((technique) => technique.id === pending?.techniqueId)?.kind === "ki",
        phase,
        caption: `${names[event.actor]} usou ${pending?.techniqueName ?? "um ataque"}!`,
      });
      pending = undefined;
    } else if (event.type === "phase") {
      phase = event.name;
      frames.push({
        seq: event.seq,
        round: event.round,
        kind: "phase",
        before: { ...vitals },
        after: { ...vitals },
        phase,
        caption: event.name,
      });
    } else if (event.type === "effect") {
      const before = { ...vitals };
      if (event.remainingKi !== undefined)
        vitals = {
          ...vitals,
          [event.actor === "player" ? "playerKi" : "enemyKi"]: event.remainingKi,
        };
      if (event.remainingHp !== undefined)
        vitals = {
          ...vitals,
          [event.actor === "player" ? "playerHp" : "enemyHp"]: event.remainingHp,
        };
      frames.push({
        seq: event.seq,
        round: event.round,
        kind: "effect",
        before,
        after: { ...vitals },
        actor: event.actor,
        phase,
        caption: `${names[event.actor]}: ${event.description}`,
      });
    } else if (event.type === "end") {
      frames.push({
        seq: event.seq,
        round: event.round,
        kind: "end",
        before: { ...vitals },
        after: { ...vitals },
        phase,
        outcome: event.outcome,
        caption:
          event.outcome === "victory"
            ? "Vitória!"
            : event.outcome === "defeat"
              ? "Você foi derrotado."
              : "Combate encerrado em empate.",
      });
    }
  }
  return { initial, final: vitals, maximum, frames };
}

export const techniqueFxColor: Readonly<Partial<Record<string, string>>> = {
  kamehameha: "#41d6ff",
  "rajada-ki": "#45cfff",
  masenko: "#ffde43",
  "galick-gun": "#bd75ff",
};
