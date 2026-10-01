import { CombatRuleError, createCombat, type CombatInput } from "./combat";
import { itemRecovery, rewardMultiplier } from "./economy";
import { requiresManualCombat } from "./combat-access";
import type {
  ActiveBattle,
  AutoItems,
  BattleEvent,
  CombatCommand,
  CombatFighter,
  CombatState,
  EnemyMove,
  ItemDefinition,
  StatusKind,
  TechniqueDefinition,
} from "./types";

type EventInput = BattleEvent extends infer E
  ? E extends BattleEvent
    ? Omit<E, "seq">
    : never
  : never;
const emit = (s: CombatState, e: EventInput) =>
  s.events.push({ ...e, seq: s.events.length } as BattleEvent);
const statusActive = (f: CombatFighter, kind: StatusKind, ahead = 0) =>
  f.statuses?.some((s) => s.kind === kind && s.expires > f.turns + ahead) ?? false;
function addStatus(f: CombatFighter, kind: StatusKind, turns: number, random: () => number) {
  if (kind === "paralysis" && (f.paralysisImmuneUntil ?? 0) > f.turns) return false;
  if (random() < (f.stats.statusResistance ?? 0)) return false;
  f.statuses = (f.statuses ?? []).filter((s) => s.kind !== kind);
  f.statuses.push({ kind, expires: f.turns + turns + 1 });
  if (kind === "paralysis") f.paralysisImmuneUntil = f.turns + 4;
  return true;
}
function nextIntent(s: CombatState): EnemyMove {
  const phase = s.phases.at(-1);
  const pattern = (phase !== undefined ? s.definition.phases[phase]?.pattern : undefined) ??
    s.definition.pattern ?? [{ kind: "attack", label: "Prepara um ataque", techniqueId: "soco" }];
  return structuredClone(pattern[s.round % pattern.length]);
}
function prepareRound(s: CombatState, random: () => number) {
  const chance = Math.max(
    0.25,
    Math.min(
      0.75,
      0.5 +
        (s.player.stats.speed - s.enemy.stats.speed) /
          (2 * (s.player.stats.speed + s.enemy.stats.speed + 20)),
    ),
  );
  s.strategic!.initiative = random() < chance ? "player" : "enemy";
  s.strategic!.intent = nextIntent(s);
  emit(s, {
    type: "intent",
    round: s.round + 1,
    description: s.strategic!.intent.label,
    initiative: s.strategic!.initiative,
  });
}
export function createStrategicCombat(
  input: CombatInput & {
    playerLevel: number;
    belt: string[];
    inventory: { itemId: string; quantity: number }[];
    items: ItemDefinition[];
    autoItems: AutoItems;
  },
): CombatState {
  const state = createCombat(input);
  state.version = 2;
  state.player.statuses = [];
  state.enemy.statuses = [];
  state.strategic = {
    initiative: "player",
    intent: { kind: "attack", label: "Prepara um ataque", techniqueId: "soco" },
    inventory: input.inventory.filter((i) => input.belt.includes(i.itemId)),
    items: input.items.filter(
      (i) => input.belt.includes(i.id) && i.type === "consumable" && !i.effects.outsideOnly,
    ),
    used: [],
    itemUses: 0,
    nextItemTurn: 0,
    senzuUsed: false,
    autoItems: input.autoItems,
    enemyCharging: false,
    playerLevel: input.playerLevel,
  };
  prepareRound(state, input.random);
  return state;
}
function itemAvailable(s: CombatState, itemId: string) {
  const st = s.strategic!;
  return (
    st.itemUses < 3 &&
    st.nextItemTurn <= s.player.turns + 1 &&
    !(itemId === "semente-deuses" && st.senzuUsed) &&
    (st.inventory.find((i) => i.itemId === itemId)?.quantity ?? 0) > 0
  );
}
export function presentStrategicCombat(
  s: CombatState,
  flags: readonly string[] = [],
): ActiveBattle {
  const techniques = [...s.player.techniques.filter((t) => t.id !== "soco"), s.fallback];
  return {
    version: 2,
    id: s.id,
    enemyId: s.definition.id,
    areaId: s.areaId,
    round: s.round + 1,
    playerHp: s.player.hp,
    playerKi: s.player.ki,
    enemyHp: s.enemy.hp,
    enemyKi: s.enemy.ki,
    enemyMaxHp: s.enemy.stats.maxHp,
    enemyMaxKi: s.enemy.stats.maxKi,
    manualOnly: requiresManualCombat(s.definition, flags),
    initiative: s.strategic!.initiative,
    intent: s.strategic!.intent,
    statuses: { player: s.player.statuses ?? [], enemy: s.enemy.statuses ?? [] },
    itemUses: s.strategic!.itemUses,
    itemCooldown: Math.max(0, s.strategic!.nextItemTurn - s.player.turns - 1),
    consumables: s.strategic!.inventory.map((i) => ({
      ...i,
      available: itemAvailable(s, i.itemId),
    })),
    techniques: techniques.map((t) => {
      const cooldownRemaining = Math.max(0, (s.player.nextUse[t.id] ?? 0) - s.player.turns - 1);
      return {
        id: t.id,
        name: t.name,
        kind: t.kind,
        kiCost: t.kiCost,
        cooldownRemaining,
        available:
          t.kiCost <= s.player.ki &&
          cooldownRemaining === 0 &&
          !statusActive(s.player, "paralysis", 1),
      };
    }),
    events: s.events,
  };
}
function automaticCommand(s: CombatState): CombatCommand {
  const st = s.strategic!,
    p = s.player;
  if (st.autoItems.enabled && st.itemUses < st.autoItems.maxUses) {
    const hpLow = p.hp / p.stats.maxHp <= st.autoItems.hpThreshold / 100,
      kiLow = p.ki / p.stats.maxKi <= st.autoItems.kiThreshold / 100;
    const item = st.items.find(
      (i) =>
        itemAvailable(s, i.id) &&
        ((hpLow && (i.effects.restoreHp ?? 0) > 0) || (kiLow && (i.effects.restoreKi ?? 0) > 0)),
    );
    if (item) return { kind: "item", itemId: item.id };
  }
  if (statusActive(p, "paralysis", 1)) return { kind: "guard" };
  const technique =
    p.techniques.find((t) => t.kiCost <= p.ki && (p.nextUse[t.id] ?? 0) <= p.turns + 1) ??
    s.fallback;
  return { kind: "attack", techniqueId: technique.id };
}
export function strategicDamage(
  actor: CombatFighter,
  target: CombatFighter,
  technique: TechniqueDefinition,
  random: () => number,
  scale = 1,
  guarded = false,
  charging = false,
) {
  const ki = technique.kind === "ki";
  const raw = ki
    ? 12 + 2.4 * (actor.stats.kiControl ?? actor.stats.strength) + 0.25 * actor.stats.strength
    : 12 + 2 * actor.stats.strength + 0.4 * actor.stats.speed;
  const defense = target.stats.defense * (statusActive(target, "armor-break") ? 0.65 : 1);
  const critical = random() < (actor.stats.critical ?? 0.05);
  const dodge = Math.min(
    0.15,
    (target.stats.evasion ?? 0) +
      (target.stats.speed / (target.stats.speed + 80)) * 0.08 +
      ((target.evasionBuffUntil ?? 0) > target.turns ? (target.evasionBuffAmount ?? 0) : 0),
  );
  if (random() < dodge) return { damage: 0, critical: false, dodged: true };
  const damage = Math.max(
    1,
    Math.round(
      ((raw * technique.multiplier * scale * 100) / (100 + 2.5 * defense)) *
        (0.95 + 0.1 * random()) *
        (critical ? 1.5 : 1) *
        (guarded ? 0.5 + (actor.stats.guardBreak ?? 0) : 1) *
        (charging ? 1.25 : 1) *
        (ki && (actor.damageBuffUntil ?? 0) > actor.turns ? 1 + (actor.damageBuffAmount ?? 0) : 1) *
        (ki ? 1 : 1 - (target.stats.physicalResistance ?? 0)),
    ),
  );
  return { damage, critical, dodged: false };
}
function finish(s: CombatState, random: () => number) {
  if (s.player.hp > 0 && s.enemy.hp > 0 && s.round < 60) return;
  const outcome =
    s.enemy.hp === 0 && s.player.hp === 0
      ? "draw"
      : s.enemy.hp === 0
        ? "victory"
        : s.player.hp === 0
          ? "defeat"
          : "draw";
  const drops: { itemId: string; quantity: number }[] = [];
  if (outcome === "victory") {
    for (const d of s.drops)
      if (random() < d.chance)
        drops.push({
          itemId: d.itemId,
          quantity: d.minQuantity + Math.floor(random() * (d.maxQuantity - d.minQuantity + 1)),
        });
    if (s.definition.guaranteedItem) {
      const owned = drops.find((d) => d.itemId === s.definition.guaranteedItem);
      if (owned) owned.quantity++;
      else drops.push({ itemId: s.definition.guaranteedItem, quantity: 1 });
    }
  }
  const multiplier = rewardMultiplier(s.strategic!.playerLevel, s.definition.level);
  const xp = outcome === "victory" ? Math.floor(s.definition.xpReward * multiplier) : 0,
    zeni = outcome === "victory" ? Math.floor(s.definition.zeniReward * multiplier) : 0;
  if (outcome === "victory") emit(s, { type: "reward", round: s.round, xp, zeni, drops });
  emit(s, { type: "end", round: s.round, outcome });
  s.result = {
    version: 2,
    id: s.id,
    enemyId: s.definition.id,
    areaId: s.areaId,
    outcome,
    playerHp: s.player.hp,
    playerKi: s.player.ki,
    xp,
    zeni,
    drops,
    events: s.events,
    usedItems: s.strategic!.used,
    rewardMultiplier: multiplier,
  };
}
export function advanceStrategicCombat(
  previous: CombatState,
  input: CombatCommand | undefined,
  random: () => number,
): CombatState {
  if (previous.result) throw new CombatRuleError("BATTLE_FINISHED", "Este combate já terminou.");
  if (previous.version !== 2 || !previous.strategic)
    throw new CombatRuleError("LEGACY_ACTION", "Conclua o combate antigo usando suas técnicas.");
  const command = input ?? automaticCommand(previous),
    st = previous.strategic;
  let selected: TechniqueDefinition | undefined, item: ItemDefinition | undefined;
  if (command.kind === "attack") {
    selected = [...previous.player.techniques, previous.fallback].find(
      (t) => t.id === command.techniqueId,
    );
    if (!selected)
      throw new CombatRuleError("TECHNIQUE_LOCKED", "Esta técnica não está disponível.");
    if (statusActive(previous.player, "paralysis", 1))
      throw new CombatRuleError("PARALYZED", "Você está paralisado: defenda ou use um item.");
    if (selected.kiCost > previous.player.ki)
      throw new CombatRuleError("NO_KI", "Ki insuficiente.");
    if ((previous.player.nextUse[selected.id] ?? 0) > previous.player.turns + 1)
      throw new CombatRuleError("TECHNIQUE_COOLDOWN", "Esta técnica ainda está em recarga.");
  } else if (command.kind === "item") {
    item = st.items.find((i) => i.id === command.itemId);
    if (!item || !itemAvailable(previous, item.id))
      throw new CombatRuleError(
        "ITEM_UNAVAILABLE",
        "Item indisponível, em recarga ou limite de três usos atingido.",
      );
    const recovered = itemRecovery(
      previous.player.hp,
      previous.player.ki,
      previous.player.stats.maxHp,
      previous.player.stats.maxKi,
      item,
    );
    const canCure = item.effects.cure?.some((kind) => statusActive(previous.player, kind));
    const canBuff =
      item.effects.kiDamageBuff &&
      !(previous.player.damageBuffUntil && previous.player.damageBuffUntil > previous.player.turns);
    if (
      recovered.hp === previous.player.hp &&
      recovered.ki === previous.player.ki &&
      !canCure &&
      !canBuff
    )
      throw new CombatRuleError("NO_EFFECT", "Este item não terá efeito. Ele foi preservado.");
  } else if (command.kind === "charge" && previous.player.ki >= previous.player.stats.maxKi)
    throw new CombatRuleError("NO_EFFECT", "Seu Ki já está completo.");
  const s = structuredClone(previous),
    p = s.player,
    e = s.enemy,
    round = ++s.round;
  let intent = s.strategic!.intent;
  const playerGuard = command.kind === "guard",
    enemyGuard = intent.kind === "guard";
  if (playerGuard)
    emit(s, {
      type: "effect",
      round,
      actor: "player",
      description: "Defendeu: dano recebido reduzido em 50% nesta rodada",
    });
  if (enemyGuard)
    emit(s, {
      type: "effect",
      round,
      actor: "enemy",
      description: "Assumiu guarda: dano recebido reduzido em 50%",
    });
  if (command.kind === "charge") {
    p.ki = Math.min(p.stats.maxKi, p.ki + Math.floor(p.stats.maxKi * 0.2));
    emit(s, {
      type: "effect",
      round,
      actor: "player",
      description: "Concentrou Ki: recuperou energia, mas ficou vulnerável",
      remainingKi: p.ki,
    });
  }
  const order: ("player" | "enemy")[] =
    s.strategic!.initiative === "player" ? ["player", "enemy"] : ["enemy", "player"];
  for (const actorId of order) {
    if (p.hp <= 0 || e.hp <= 0) break;
    const actor = actorId === "player" ? p : e,
      target = actorId === "player" ? e : p,
      targetId = actorId === "player" ? "enemy" : "player";
    actor.turns++;
    actor.statuses = (actor.statuses ?? []).filter((status) => status.expires > actor.turns);
    actor.buffs = actor.buffs.filter((buff) => {
      if (actor.turns >= buff.expires) {
        actor.stats[buff.attribute] = (actor.stats[buff.attribute] ?? 0) - buff.amount;
        return false;
      }
      return true;
    });
    if (actorId === "player" && command.kind === "item") {
      const it = item!;
      Object.assign(p, itemRecovery(p.hp, p.ki, p.stats.maxHp, p.stats.maxKi, it));
      p.statuses = (p.statuses ?? []).filter((status) => !it.effects.cure?.includes(status.kind));
      if (it.effects.kiDamageBuff) {
        p.damageBuffUntil = p.turns + 4;
        p.damageBuffAmount = it.effects.kiDamageBuff;
      }
      const strategy = s.strategic!;
      strategy.inventory.find((i) => i.itemId === it.id)!.quantity--;
      const used = strategy.used.find((i) => i.itemId === it.id);
      if (used) used.quantity++;
      else strategy.used.push({ itemId: it.id, quantity: 1 });
      strategy.itemUses++;
      strategy.nextItemTurn = p.turns + 3;
      if (it.id === "semente-deuses") strategy.senzuUsed = true;
      emit(s, {
        type: "effect",
        round,
        actor: "player",
        description: `Usou ${it.name}`,
        remainingHp: p.hp,
        remainingKi: p.ki,
      });
    } else if (actorId === "enemy" && intent.kind === "charge") {
      e.ki = Math.min(e.stats.maxKi, e.ki + Math.floor(e.stats.maxKi * 0.25));
      s.strategic!.enemyCharging = true;
      emit(s, {
        type: "effect",
        round,
        actor: "enemy",
        description: "Carregou energia: o próximo ataque será fortalecido",
        remainingKi: e.ki,
      });
    } else if (
      (actorId === "player" && command.kind !== "attack") ||
      (actorId === "enemy" && intent.kind === "guard")
    ) {
      // Guard/charge already applied before initiative. Both consume exactly one action.
    } else if (statusActive(actor, "paralysis")) {
      emit(s, { type: "effect", round, actor: actorId, description: "Paralisia impediu o ataque" });
    } else {
      let technique =
        actorId === "player"
          ? selected!
          : (actor.techniques.find((t) => t.id === intent.techniqueId) ?? s.fallback);
      if (technique.kiCost > actor.ki || (actor.nextUse[technique.id] ?? 0) > actor.turns)
        technique = s.fallback;
      actor.ki -= technique.kiCost;
      actor.nextUse[technique.id] = actor.turns + technique.cooldown + 1;
      if (technique.hpCost) {
        actor.hp = Math.max(1, actor.hp - Math.floor(actor.stats.maxHp * technique.hpCost));
        emit(s, {
          type: "effect",
          round,
          actor: actorId,
          description: "Sacrificou vitalidade para usar Kikohou",
          remainingHp: actor.hp,
        });
      }
      if (technique.kiCost)
        emit(s, {
          type: "skill",
          round,
          actor: actorId,
          techniqueId: technique.id,
          kiCost: technique.kiCost,
          remainingKi: actor.ki,
        });
      emit(s, {
        type: "attack",
        round,
        actor: actorId,
        target: targetId,
        techniqueId: technique.id,
        techniqueName: technique.name,
      });
      const charged = actorId === "enemy" && s.strategic!.enemyCharging;
      const strike = strategicDamage(
        actor,
        target,
        technique,
        random,
        actorId === "enemy" ? (intent.multiplier ?? 1) * (charged ? 1.35 : 1) : 1,
        actorId === "enemy" ? playerGuard : enemyGuard,
        actorId === "enemy" ? command.kind === "charge" : intent.kind === "charge",
      );
      if (actorId === "enemy") s.strategic!.enemyCharging = false;
      target.hp = Math.max(0, target.hp - strike.damage);
      emit(s, {
        type: "damage",
        round,
        actor: actorId,
        target: targetId,
        amount: strike.damage,
        remainingHp: target.hp,
      });
      if (strike.dodged || strike.critical)
        emit(s, {
          type: "effect",
          round,
          actor: strike.dodged ? targetId : actorId,
          description: strike.dodged ? "Esquivou do ataque" : "Acerto crítico",
        });
      if (strike.damage > 0 && target.hp > 0) {
        for (const effect of technique.effects) {
          if (effect.kind === "interrupt" && actorId === "player") {
            s.strategic!.enemyCharging = false;
            if (intent.kind === "charge")
              intent = s.strategic!.intent = { kind: "guard", label: "Concentração interrompida" };
            emit(s, {
              type: "effect",
              round,
              actor: targetId,
              description: "Sua concentração foi interrompida",
            });
          } else if (
            effect.kind === "status" &&
            addStatus(target, effect.status, effect.turns, random)
          )
            emit(s, {
              type: "effect",
              round,
              actor: targetId,
              description:
                effect.status === "poison"
                  ? "Envenenado"
                  : effect.status === "paralysis"
                    ? "Paralisado por uma rodada"
                    : "Defesa enfraquecida",
            });
          else if (effect.kind === "evasion") {
            actor.evasionBuffUntil = actor.turns + effect.turns + 1;
            actor.evasionBuffAmount = effect.amount;
            emit(s, {
              type: "effect",
              round,
              actor: actorId,
              description: "Criou uma imagem residual para esquivar",
            });
          } else if (effect.kind === "buff") {
            actor.stats[effect.attribute] = (actor.stats[effect.attribute] ?? 0) + effect.amount;
            actor.buffs.push({
              attribute: effect.attribute,
              amount: effect.amount,
              expires: actor.turns + effect.turns + 1,
            });
          } else if (effect.kind === "heal") {
            actor.hp = Math.min(
              actor.stats.maxHp,
              actor.hp + Math.floor(actor.stats.maxHp * effect.fraction),
            );
            emit(s, {
              type: "effect",
              round,
              actor: actorId,
              description: "Recuperou vitalidade",
              remainingHp: actor.hp,
            });
          }
        }
        if (
          actorId === "enemy" &&
          intent.status &&
          addStatus(target, intent.status, intent.status === "paralysis" ? 1 : 3, random)
        )
          emit(s, {
            type: "effect",
            round,
            actor: targetId,
            description:
              intent.status === "poison"
                ? "Envenenado"
                : intent.status === "paralysis"
                  ? "Paralisado por uma rodada"
                  : "Defesa enfraquecida",
          });
      }
      if (target.hp === 0) emit(s, { type: "defeat", round, actor: targetId });
    }
    if (actor.hp > 0 && statusActive(actor, "poison")) {
      actor.hp = Math.max(0, actor.hp - Math.max(1, Math.floor(actor.stats.maxHp * 0.04)));
      emit(s, {
        type: "effect",
        round,
        actor: actorId,
        description: "Sofreu dano de veneno",
        remainingHp: actor.hp,
      });
      if (actor.hp === 0) emit(s, { type: "defeat", round, actor: actorId });
    }
  }
  s.definition.phases.forEach((phase, index) => {
    if (!s.phases.includes(index) && e.hp > 0 && e.hp / e.stats.maxHp <= phase.threshold) {
      s.phases.push(index);
      e.stats.strength = Math.round(s.definition.attributes.strength * phase.strengthMultiplier);
      e.stats.kiControl = Math.round(
        (s.definition.attributes.kiControl ?? s.definition.attributes.strength) *
          phase.strengthMultiplier,
      );
      emit(s, { type: "phase", round, name: phase.name });
    }
  });
  finish(s, random);
  if (!s.result) prepareRound(s, random);
  return s;
}
