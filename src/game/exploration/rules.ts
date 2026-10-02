import { unmetRequirements } from "../requirements";
import type { Attributes, CharacterState, ItemDefinition } from "../types";
import type {
  ActiveExploration,
  ExplorationCategory,
  ExplorationChoice,
  ExplorationEventDefinition,
  ExplorationResult,
  ExplorationReward,
  ExplorationRewardDefinition,
  ExplorationSession,
  ExplorationRoute,
} from "./types";

export const explorationWeights: Record<ExplorationCategory, number> = {
  gather: 35,
  npc: 20,
  danger: 15,
  treasure: 25,
  discovery: 4.5,
  exceptional: 0.5,
};
const categoryOrder: ExplorationCategory[] = [
  "gather",
  "npc",
  "danger",
  "treasure",
  "discovery",
  "exceptional",
];
export function explorationWeightsForRoute(
  route?: ExplorationRoute,
): Record<ExplorationCategory, number> {
  const commonTotal = categoryOrder
    .slice(0, 4)
    .reduce(
      (sum, key) =>
        sum + explorationWeights[key] * (route?.favoredCategories.includes(key) ? 2 : 1),
      0,
    );
  return Object.fromEntries(
    categoryOrder.map((key) => [
      key,
      categoryOrder.indexOf(key) < 4
        ? (95 * explorationWeights[key] * (route?.favoredCategories.includes(key) ? 2 : 1)) /
          commonTotal
        : explorationWeights[key],
    ]),
  ) as Record<ExplorationCategory, number>;
}
export const emptyExplorationReward = (): ExplorationReward => ({
  items: [],
  zeni: 0,
  xp: 0,
  flags: [],
});
export class ExplorationRuleError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function explorationChance(value: number, target: number, bonus = 0) {
  if (!Number.isFinite(value) || !Number.isFinite(target) || target <= 0)
    throw new ExplorationRuleError("INVALID_CHECK", "Dificuldade de encontro inválida.");
  return Math.round(
    Math.max(10, Math.min(90, 50 + ((value - target) / (2 * target)) * 100 + bonus)),
  );
}
type Context = {
  character: Pick<
    CharacterState,
    "level" | "raceId" | "flags" | "hp" | "ki" | "zeni" | "equipment"
  >;
  powerLevel: number;
  inventory: { itemId: string; quantity: number }[];
  items: ItemDefinition[];
  maxHp: number;
};
export function selectExplorationEvent(
  events: ExplorationEventDefinition[],
  areaId: string,
  ctx: Context,
  random: () => number,
  route?: ExplorationRoute,
) {
  const eligible = events.filter(
    (event) =>
      event.areaId === areaId &&
      unmetRequirements(event.requirements, { ...ctx.character, powerLevel: ctx.powerLevel })
        .length === 0,
  );
  if (!eligible.length)
    throw new ExplorationRuleError(
      "NO_ENCOUNTERS",
      "Esta região ainda não possui encontros disponíveis.",
    );
  // Routes favor common occurrences. Valuable discoveries retain their original odds.
  const weights = explorationWeightsForRoute(route);
  const roll = random() * 100;
  let total = 0,
    category = categoryOrder[0];
  for (const candidate of categoryOrder) {
    total += weights[candidate];
    if (roll < total) {
      category = candidate;
      break;
    }
  }
  let candidates = eligible.filter((event) => event.category === category);
  for (let index = categoryOrder.indexOf(category) - 1; !candidates.length && index >= 0; index--)
    candidates = eligible.filter((event) => event.category === categoryOrder[index]);
  if (!candidates.length)
    throw new ExplorationRuleError(
      "NO_ENCOUNTERS",
      "Não há ocorrência disponível nesta categoria.",
    );
  const weight = (event: ExplorationEventDefinition) =>
    event.weight * (route?.favoredCategories.includes(event.category) ? 2 : 1);
  let selection = random() * candidates.reduce((sum, event) => sum + weight(event), 0);
  return (
    candidates.find((event) => (selection -= weight(event)) < 0) ??
    candidates[candidates.length - 1]
  );
}
function rollReward(
  definition: ExplorationRewardDefinition | undefined,
  random: () => number,
): ExplorationReward {
  const number = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  return {
    items:
      definition?.items?.map((item) => ({
        itemId: item.itemId,
        quantity: number(item.min, item.max),
      })) ?? [],
    zeni: definition?.zeni ? number(definition.zeni.min, definition.zeni.max) : 0,
    xp: definition?.xp ?? 0,
    flags: [...(definition?.flags ?? [])],
  };
}
function combine(a: ExplorationReward, b: ExplorationReward): ExplorationReward {
  const quantities = new Map<string, number>();
  for (const item of [...a.items, ...b.items])
    quantities.set(item.itemId, (quantities.get(item.itemId) ?? 0) + item.quantity);
  return {
    items: [...quantities].map(([itemId, quantity]) => ({ itemId, quantity })),
    zeni: a.zeni + b.zeni,
    xp: a.xp + b.xp,
    flags: [...new Set([...a.flags, ...b.flags])],
  };
}
export function createExplorationSession(
  event: ExplorationEventDefinition,
  id: string,
  attributes: Attributes,
  random: () => number,
  routeId: string | null = null,
): ExplorationSession {
  return {
    id,
    areaId: event.areaId,
    routeId,
    event: structuredClone(event),
    stageId: event.stages[0].id,
    revision: 0,
    status: "active",
    attributes: { ...attributes },
    pending: emptyExplorationReward(),
    granted: emptyExplorationReward(),
    lost: emptyExplorationReward(),
    message: "",
    log: [],
    rolls: Object.fromEntries(
      event.stages.flatMap((stage) =>
        stage.choices.map((choice) => [
          `${stage.id}:${choice.id}`,
          {
            chance: random() * 100,
            success: rollReward(choice.success.reward, random),
            failure: rollReward(choice.failure?.reward, random),
          },
        ]),
      ),
    ),
  };
}
function toolBonus(session: ExplorationSession, choice: ExplorationChoice, ctx: Context) {
  return Math.max(
    0,
    ...ctx.items
      .filter((item) => {
        const effect = item.effects.exploration;
        return (
          effect &&
          (!effect.areaIds || effect.areaIds.includes(session.areaId)) &&
          (!effect.attribute || effect.attribute === choice.check?.attribute) &&
          (item.type === "equipment"
            ? Object.values(ctx.character.equipment).includes(item.id)
            : ctx.inventory.some((owned) => owned.itemId === item.id && owned.quantity > 0))
        );
      })
      .map((item) => item.effects.exploration!.bonus),
  );
}
export function choiceAvailability(
  session: ExplorationSession,
  choice: ExplorationChoice,
  ctx: Context,
) {
  const reasons: string[] = [];
  if (choice.cost?.ki && ctx.character.ki < choice.cost.ki) reasons.push("Ki insuficiente");
  if (choice.cost?.zeni && ctx.character.zeni < choice.cost.zeni) reasons.push("Zeni insuficiente");
  for (const item of choice.cost?.items ?? [])
    if (
      (ctx.inventory.find((owned) => owned.itemId === item.itemId)?.quantity ?? 0) < item.quantity
    )
      reasons.push(
        `Precisa de ${item.quantity} ${ctx.items.find((candidate) => candidate.id === item.itemId)?.name ?? item.itemId}`,
      );
  const requirement = choice.requirement;
  if (
    requirement?.attribute &&
    (session.attributes[requirement.attribute] ?? 0) < (requirement.minimum ?? 0)
  )
    reasons.push(`Atributo mínimo: ${requirement.minimum}`);
  if (
    requirement?.itemId &&
    !ctx.inventory.some((item) => item.itemId === requirement.itemId && item.quantity > 0)
  )
    reasons.push("Ferramenta necessária");
  if (choice.onceFlag && ctx.character.flags.includes(choice.onceFlag))
    reasons.push("Você já concluiu esta descoberta");
  return {
    reasons,
    chance: choice.check
      ? explorationChance(
          session.attributes[choice.check.attribute] ?? 0,
          choice.check.target,
          toolBonus(session, choice, ctx),
        )
      : 100,
  };
}
export function finishExploration(
  session: ExplorationSession,
  status: "success" | "failed" | "abandoned",
  message: string,
): ExplorationSession {
  const next = structuredClone(session);
  next.status = status;
  next.message = message;
  if (status === "success") next.granted = combine(next.granted, next.pending);
  else next.lost = combine(next.lost, next.pending);
  next.pending = emptyExplorationReward();
  next.log.push(message);
  return next;
}
export function resolveExploration(
  session: ExplorationSession,
  revision: number,
  choiceId: string,
  ctx: Context,
) {
  if (session.status !== "active" || revision !== session.revision)
    throw new ExplorationRuleError(
      "STALE_ENCOUNTER",
      "Esta etapa já foi resolvida. Atualize o encontro.",
    );
  const stage = session.event.stages.find((stage) => stage.id === session.stageId);
  const choice = stage?.choices.find((choice) => choice.id === choiceId);
  if (!choice)
    throw new ExplorationRuleError("INVALID_CHOICE", "Esta opção não pertence à etapa atual.");
  const availability = choiceAvailability(session, choice, ctx);
  if (availability.reasons.length)
    throw new ExplorationRuleError("CHOICE_REQUIREMENTS", availability.reasons.join(" · "));
  const next = structuredClone(session);
  const rolled = next.rolls[`${stage!.id}:${choice.id}`];
  const success = rolled.chance < availability.chance;
  const outcome = success ? choice.success : choice.failure;
  if (!outcome)
    throw new ExplorationRuleError("INVALID_EVENT", "Encontro sem consequência configurada.");
  next.revision++;
  next.message = outcome.message;
  next.log.push(`${choice.label}: ${outcome.message}`);
  next.pending = combine(next.pending, success ? rolled.success : rolled.failure);
  if (outcome.loseFinds) {
    next.lost = combine(next.lost, next.pending);
    next.pending = emptyExplorationReward();
  }
  if (outcome.enemyId) {
    next.status = "battle";
    next.enemyId = outcome.enemyId;
  } else if (outcome.nextStageId) next.stageId = outcome.nextStageId;
  else
    return {
      session: finishExploration(next, success ? "success" : "failed", outcome.message),
      cost: choice.cost,
      damage: Math.floor(ctx.maxHp * (outcome.damageHpFraction ?? 0)),
    };
  return {
    session: next,
    cost: choice.cost,
    damage: Math.floor(ctx.maxHp * (outcome.damageHpFraction ?? 0)),
  };
}
export function presentExploration(session: ExplorationSession, ctx: Context): ActiveExploration {
  const stage = session.event.stages.find((stage) => stage.id === session.stageId)!;
  return {
    id: session.id,
    areaId: session.areaId,
    routeId: session.routeId,
    title: session.event.title,
    description: session.event.description,
    npcId: session.event.npcId,
    npcName: session.event.npcName,
    artKind: session.event.artKind,
    category: session.event.category,
    rarity: session.event.rarity,
    stageId: session.stageId,
    revision: session.revision,
    stageTitle: stage.title,
    stageText: stage.text,
    status: session.status as "active" | "battle",
    pending: session.pending,
    message: session.message,
    log: session.log,
    battleId: session.battleId,
    choices:
      session.status === "battle"
        ? []
        : stage.choices.map((choice) => ({
            id: choice.id,
            label: choice.label,
            description: choice.description,
            risk: choice.risk,
            cost: choice.cost,
            check: choice.check,
            ...choiceAvailability(session, choice, ctx),
          })),
  };
}
export function explorationResult(session: ExplorationSession): ExplorationResult {
  return {
    id: session.id,
    areaId: session.areaId,
    title: session.event.title,
    rarity: session.event.rarity,
    category: session.event.category,
    status: session.status as ExplorationResult["status"],
    message: session.message,
    rewards: session.granted,
    lost: session.lost,
    log: session.log,
    battleId: session.battleId,
  };
}
