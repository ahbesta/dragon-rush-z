import type {
  Attributes,
  BattleEvent,
  BattleResult,
  BossPhase,
  DerivedStats,
  DropDefinition,
  EnemyDefinition,
  TechniqueDefinition,
} from "./types";

type Fighter = {
  name: string;
  hp: number;
  ki: number;
  stats: DerivedStats;
  techniques: TechniqueDefinition[];
  turns: number;
  nextUse: Map<string, number>;
  buffs: { attribute: keyof Attributes; amount: number; expires: number }[];
};
type EventInput = BattleEvent extends infer T
  ? T extends BattleEvent
    ? Omit<T, "seq">
    : never
  : never;
export type CombatInput = {
  id: string;
  player: {
    name: string;
    hp: number;
    ki: number;
    stats: DerivedStats;
    techniques: TechniqueDefinition[];
  };
  enemy: EnemyDefinition;
  techniques: TechniqueDefinition[];
  drops: DropDefinition[];
  random: () => number;
};

export function calculateDamage(
  attacker: DerivedStats,
  defender: DerivedStats,
  technique: TechniqueDefinition,
  random: number,
): number {
  const raw =
    technique.kind === "ki"
      ? (1.5 * attacker.strength + 0.15 * attacker.maxKi) * technique.multiplier -
        0.6 * defender.defense
      : (2 * attacker.strength + 0.5 * attacker.speed) * technique.multiplier -
        0.75 * defender.defense;
  return Math.max(1, Math.round(Math.max(1, raw) * (0.9 + 0.2 * random)));
}

export function simulateBattle(input: CombatInput): BattleResult {
  const { enemy, random } = input;
  const fallback = input.techniques.find((t) => t.id === "soco");
  if (!fallback) throw new Error("Catálogo sem Soco");
  const enemyStats = { ...enemy.attributes, maxHp: enemy.maxHp, maxKi: enemy.maxKi, powerLevel: 0 };
  const player: Fighter = {
    ...input.player,
    stats: { ...input.player.stats },
    turns: 0,
    nextUse: new Map(),
    buffs: [],
  };
  const foe: Fighter = {
    name: enemy.name,
    hp: enemy.maxHp,
    ki: enemy.maxKi,
    stats: enemyStats,
    techniques: enemy.techniqueIds
      .map((id) => input.techniques.find((t) => t.id === id))
      .filter((t): t is TechniqueDefinition => Boolean(t)),
    turns: 0,
    nextUse: new Map(),
    buffs: [],
  };
  const events: BattleEvent[] = [];
  const emit = (event: EventInput) => events.push({ ...event, seq: events.length } as BattleEvent);
  const phases = new Set<number>();
  const applyPhase = (phase: BossPhase, round: number) => {
    foe.stats.strength = Math.round(enemy.attributes.strength * phase.strengthMultiplier);
    emit({ type: "phase", round, name: phase.name });
  };
  emit({
    type: "start",
    round: 0,
    player: player.name,
    enemy: enemy.name,
    playerHp: player.hp,
    enemyHp: foe.hp,
  });
  let lastRound = 0;
  for (let round = 1; round <= 60 && player.hp > 0 && foe.hp > 0; round++) {
    lastRound = round;
    const playerFirst =
      player.stats.speed === foe.stats.speed
        ? random() < 0.5
        : player.stats.speed > foe.stats.speed;
    const order: ("player" | "enemy")[] = playerFirst ? ["player", "enemy"] : ["enemy", "player"];
    for (const actorId of order) {
      if (player.hp <= 0 || foe.hp <= 0) break;
      const actor = actorId === "player" ? player : foe;
      const target = actorId === "player" ? foe : player;
      const targetId = actorId === "player" ? "enemy" : "player";
      enemy.phases.forEach((phase, index) => {
        if (!phases.has(index) && foe.hp / foe.stats.maxHp <= phase.threshold) {
          phases.add(index);
          applyPhase(phase, round);
        }
      });
      actor.turns++;
      actor.buffs = actor.buffs.filter((buff) => {
        if (actor.turns >= buff.expires) {
          actor.stats[buff.attribute] -= buff.amount;
          return false;
        }
        return true;
      });
      const technique =
        actor.techniques.find(
          (t) => t.kiCost <= actor.ki && (actor.nextUse.get(t.id) ?? 0) <= actor.turns,
        ) ?? fallback;
      actor.ki -= technique.kiCost;
      actor.nextUse.set(technique.id, actor.turns + technique.cooldown + 1);
      if (technique.kind === "ki")
        emit({
          type: "skill",
          round,
          actor: actorId,
          techniqueId: technique.id,
          kiCost: technique.kiCost,
          remainingKi: actor.ki,
        });
      emit({
        type: "attack",
        round,
        actor: actorId,
        target: targetId,
        techniqueId: technique.id,
        techniqueName: technique.name,
      });
      const damage = calculateDamage(actor.stats, target.stats, technique, random());
      target.hp = Math.max(0, target.hp - damage);
      emit({
        type: "damage",
        round,
        actor: actorId,
        target: targetId,
        amount: damage,
        remainingHp: target.hp,
      });
      for (const effect of technique.effects) {
        if (effect.kind === "heal") {
          const amount = Math.min(
            actor.stats.maxHp - actor.hp,
            Math.floor(actor.stats.maxHp * effect.fraction),
          );
          actor.hp += amount;
          emit({ type: "effect", round, actor: actorId, description: `Recuperou ${amount} HP` });
        } else {
          actor.stats[effect.attribute] += effect.amount;
          actor.buffs.push({
            attribute: effect.attribute,
            amount: effect.amount,
            expires: actor.turns + effect.turns + 1,
          });
          emit({
            type: "effect",
            round,
            actor: actorId,
            description: `${effect.attribute} +${effect.amount} por ${effect.turns} turnos`,
          });
        }
      }
      if (target.hp === 0) emit({ type: "defeat", round, actor: targetId });
    }
  }
  const outcome = foe.hp === 0 ? "victory" : player.hp === 0 ? "defeat" : "draw";
  const drops: BattleResult["drops"] = [];
  if (outcome === "victory") {
    for (const drop of input.drops.filter((d) => d.enemyId === enemy.id))
      if (random() < drop.chance) {
        drops.push({
          itemId: drop.itemId,
          quantity:
            drop.minQuantity + Math.floor(random() * (drop.maxQuantity - drop.minQuantity + 1)),
        });
      }
  }
  const xp = outcome === "victory" ? enemy.xpReward : 0;
  const zeni = outcome === "victory" ? enemy.zeniReward : 0;
  if (outcome === "victory") emit({ type: "reward", round: lastRound, xp, zeni, drops });
  emit({ type: "end", round: lastRound, outcome });
  return {
    version: 1,
    id: input.id,
    enemyId: enemy.id,
    outcome,
    playerHp: player.hp,
    playerKi: player.ki,
    xp,
    zeni,
    drops,
    events,
  };
}
