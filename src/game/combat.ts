import type {
  ActiveBattle,
  BattleEvent,
  BattleResult,
  CombatFighter,
  CombatState,
  DerivedStats,
  DropDefinition,
  EnemyDefinition,
  TechniqueDefinition,
} from "./types";

type EventInput = BattleEvent extends infer T
  ? T extends BattleEvent
    ? Omit<T, "seq">
    : never
  : never;
export type CombatInput = {
  id: string;
  areaId?: string;
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
export class CombatRuleError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

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
const emit = (state: CombatState, event: EventInput) =>
  state.events.push({ ...event, seq: state.events.length } as BattleEvent);

export function createCombat(input: CombatInput): CombatState {
  const fallback = input.techniques.find((t) => t.id === "soco");
  if (!fallback) throw new Error("Catálogo sem Soco");
  const enemy = input.enemy;
  const state: CombatState = structuredClone({
    version: 1,
    id: input.id,
    areaId: input.areaId,
    round: 0,
    player: { ...input.player, turns: 0, nextUse: {}, buffs: [] },
    enemy: {
      name: enemy.name,
      hp: enemy.maxHp,
      ki: enemy.maxKi,
      stats: { ...enemy.attributes, maxHp: enemy.maxHp, maxKi: enemy.maxKi, powerLevel: 0 },
      techniques: enemy.techniqueIds
        .map((id) => input.techniques.find((t) => t.id === id))
        .filter((t): t is TechniqueDefinition => Boolean(t)),
      turns: 0,
      nextUse: {},
      buffs: [],
    },
    definition: enemy,
    fallback,
    drops: input.drops.filter((d) => d.enemyId === enemy.id),
    phases: [],
    events: [],
    result: null,
  });
  emit(state, {
    type: "start",
    round: 0,
    player: state.player.name,
    enemy: enemy.name,
    playerHp: state.player.hp,
    enemyHp: state.enemy.hp,
    playerKi: state.player.ki,
    enemyKi: state.enemy.ki,
    playerMaxHp: state.player.stats.maxHp,
    playerMaxKi: state.player.stats.maxKi,
    enemyMaxHp: state.enemy.stats.maxHp,
    enemyMaxKi: state.enemy.stats.maxKi,
  });
  return state;
}
function playerTechniques(state: CombatState) {
  return [...state.player.techniques.filter((t) => t.id !== "soco"), state.fallback];
}
export function presentCombat(state: CombatState): ActiveBattle {
  return {
    id: state.id,
    enemyId: state.definition.id,
    areaId: state.areaId,
    round: state.round + 1,
    playerHp: state.player.hp,
    playerKi: state.player.ki,
    enemyHp: state.enemy.hp,
    enemyKi: state.enemy.ki,
    enemyMaxHp: state.enemy.stats.maxHp,
    enemyMaxKi: state.enemy.stats.maxKi,
    techniques: playerTechniques(state).map((t) => {
      const cooldownRemaining = Math.max(
        0,
        (state.player.nextUse[t.id] ?? 0) - state.player.turns - 1,
      );
      return {
        id: t.id,
        name: t.name,
        kind: t.kind,
        kiCost: t.kiCost,
        cooldownRemaining,
        available: t.kiCost <= state.player.ki && cooldownRemaining === 0,
      };
    }),
    events: state.events,
  };
}
function chooseTechnique(actor: CombatFighter, fallback: TechniqueDefinition, nextTurn: number) {
  return (
    actor.techniques.find((t) => t.kiCost <= actor.ki && (actor.nextUse[t.id] ?? 0) <= nextTurn) ??
    fallback
  );
}
function completeCombat(state: CombatState, random: () => number) {
  if (state.player.hp > 0 && state.enemy.hp > 0 && state.round < 60) return;
  const outcome = state.enemy.hp === 0 ? "victory" : state.player.hp === 0 ? "defeat" : "draw";
  const drops: BattleResult["drops"] = [];
  if (outcome === "victory") {
    for (const drop of state.drops)
      if (random() < drop.chance)
        drops.push({
          itemId: drop.itemId,
          quantity:
            drop.minQuantity + Math.floor(random() * (drop.maxQuantity - drop.minQuantity + 1)),
        });
  }
  const xp = outcome === "victory" ? state.definition.xpReward : 0;
  const zeni = outcome === "victory" ? state.definition.zeniReward : 0;
  if (outcome === "victory") emit(state, { type: "reward", round: state.round, xp, zeni, drops });
  emit(state, { type: "end", round: state.round, outcome });
  state.result = {
    version: 1,
    id: state.id,
    enemyId: state.definition.id,
    areaId: state.areaId,
    outcome,
    playerHp: state.player.hp,
    playerKi: state.player.ki,
    xp,
    zeni,
    drops,
    events: state.events,
  };
}

// Uma rodada resolve os dois lados; a iniciativa continua sendo calculada pelo servidor.
export function advanceCombat(
  previous: CombatState,
  techniqueId: string | undefined,
  random: () => number,
): CombatState {
  if (previous.result) throw new CombatRuleError("BATTLE_FINISHED", "Este combate já terminou.");
  let selected: TechniqueDefinition | undefined;
  if (techniqueId !== undefined) {
    selected = playerTechniques(previous).find((t) => t.id === techniqueId);
    if (!selected)
      throw new CombatRuleError(
        "TECHNIQUE_LOCKED",
        "Esta técnica não está disponível neste combate.",
      );
    if (selected.kiCost > previous.player.ki)
      throw new CombatRuleError("NO_KI", "Ki insuficiente para esta técnica.");
    if ((previous.player.nextUse[selected.id] ?? 0) > previous.player.turns + 1)
      throw new CombatRuleError("TECHNIQUE_COOLDOWN", "Esta técnica ainda está em recarga.");
  }
  const state = structuredClone(previous);
  const { player, enemy: foe } = state;
  const round = ++state.round;
  const playerFirst =
    player.stats.speed === foe.stats.speed ? random() < 0.5 : player.stats.speed > foe.stats.speed;
  const order: ("player" | "enemy")[] = playerFirst ? ["player", "enemy"] : ["enemy", "player"];
  for (const actorId of order) {
    if (player.hp <= 0 || foe.hp <= 0) break;
    const actor = actorId === "player" ? player : foe;
    const target = actorId === "player" ? foe : player;
    const targetId = actorId === "player" ? "enemy" : "player";
    state.definition.phases.forEach((phase, index) => {
      if (!state.phases.includes(index) && foe.hp / foe.stats.maxHp <= phase.threshold) {
        state.phases.push(index);
        foe.stats.strength = Math.round(
          state.definition.attributes.strength * phase.strengthMultiplier,
        );
        emit(state, { type: "phase", round, name: phase.name });
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
      actorId === "player" && selected
        ? selected
        : chooseTechnique(actor, state.fallback, actor.turns);
    actor.ki -= technique.kiCost;
    actor.nextUse[technique.id] = actor.turns + technique.cooldown + 1;
    if (technique.kind === "ki")
      emit(state, {
        type: "skill",
        round,
        actor: actorId,
        techniqueId: technique.id,
        kiCost: technique.kiCost,
        remainingKi: actor.ki,
      });
    emit(state, {
      type: "attack",
      round,
      actor: actorId,
      target: targetId,
      techniqueId: technique.id,
      techniqueName: technique.name,
    });
    const damage = calculateDamage(actor.stats, target.stats, technique, random());
    target.hp = Math.max(0, target.hp - damage);
    emit(state, {
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
        emit(state, {
          type: "effect",
          round,
          actor: actorId,
          description: `Recuperou ${amount} HP`,
          remainingHp: actor.hp,
        });
      } else {
        actor.stats[effect.attribute] += effect.amount;
        actor.buffs.push({
          attribute: effect.attribute,
          amount: effect.amount,
          expires: actor.turns + effect.turns + 1,
        });
        emit(state, {
          type: "effect",
          round,
          actor: actorId,
          description: `${effect.attribute} +${effect.amount} por ${effect.turns} turnos`,
        });
      }
    }
    if (target.hp === 0) emit(state, { type: "defeat", round, actor: targetId });
  }
  completeCombat(state, random);
  return state;
}
export function finishCombat(previous: CombatState, random: () => number): BattleResult {
  let state = previous;
  while (!state.result) state = advanceCombat(state, undefined, random);
  return state.result;
}
export function simulateBattle(input: CombatInput): BattleResult {
  return finishCombat(createCombat(input), input.random);
}
