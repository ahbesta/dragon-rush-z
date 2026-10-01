import type { Transaction } from "./db/client";
import type { ActionPayload } from "@/game/validation";
import type { Catalog, CharacterState, RaceDefinition, Requirements } from "@/game/types";
import {
  attributeKeys,
  buildAttributes,
  emptyAllocation,
  pointBudget,
  respecCost,
  spentPoints,
} from "@/game/builds";
import { questReady } from "@/game/economy";
import { grantExperience } from "./character-rules";
import { GameError } from "./errors";
import * as s from "./db/schema";
import { eq } from "drizzle-orm";

type Context = {
  tx: Transaction;
  character: CharacterState;
  catalog: Catalog;
  race: RaceDefinition;
  requireAllowed: (requirements: Requirements) => void;
  addItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string, quantity: number) => Promise<void>;
};
export async function executeWorldAction(
  input: ActionPayload,
  ctx: Context,
): Promise<string | null> {
  const { tx, character: c, catalog, race, requireAllowed, addItem, removeItem } = ctx;
  const settlement = (id: string) => {
    const row = catalog.settlements.find((v) => v.id === id);
    if (!row) throw new GameError("NOT_FOUND", "Vila inexistente.", 404);
    requireAllowed(row.requirements);
    return row;
  };
  const pay = (amount: number) => {
    if (!Number.isSafeInteger(amount) || amount < 0)
      throw new GameError("INVALID_PRICE", "Preço inválido.");
    if (c.zeni < amount) throw new GameError("NOT_ENOUGH_ZENI", "Zeni insuficiente.", 409);
    c.zeni -= amount;
  };
  switch (input.action) {
    case "attributes.allocate": {
      const allocation = { ...(c.allocation ?? emptyAllocation()) };
      for (const key of attributeKeys) allocation[key] += input.points[key];
      if (spentPoints(input.points) === 0)
        throw new GameError("NO_POINTS", "Selecione os pontos que deseja distribuir.", 409);
      if (spentPoints(allocation) > pointBudget(c.level))
        throw new GameError("NOT_ENOUGH_POINTS", "Você não possui esses pontos de atributo.", 409);
      c.allocation = allocation;
      c.base = buildAttributes(race, allocation);
      return "Atributos distribuídos. Sua build e Power Level foram atualizados.";
    }
    case "attributes.respec": {
      if (!settlement(input.settlementId).respec)
        throw new GameError("SERVICE_UNAVAILABLE", "Este local não redistribui atributos.");
      if (spentPoints(c.allocation ?? emptyAllocation()) === 0)
        throw new GameError("NO_EFFECT", "Seus pontos já estão disponíveis.", 409);
      const cost = respecCost(c.level, c.respecCount ?? 0);
      pay(cost);
      c.respecCount = (c.respecCount ?? 0) + 1;
      c.allocation = emptyAllocation();
      c.base = buildAttributes(race, c.allocation);
      return `Atributos redistribuídos. ${cost === 0 ? "Primeira redistribuição gratuita." : `Custo: ${cost} Zeni.`}`;
    }
    case "belt.select": {
      for (const id of input.itemIds) {
        const item = catalog.items.find((i) => i.id === id);
        if (!item || item.type !== "consumable" || item.effects.outsideOnly)
          throw new GameError(
            "INVALID_ITEM",
            "A bolsa de combate aceita apenas consumíveis de batalha.",
          );
      }
      c.belt = input.itemIds;
      return "Bolsa de combate atualizada. Ela admite até três tipos de item.";
    }
    case "auto.items":
      c.autoItems = {
        enabled: input.enabled,
        hpThreshold: input.hpThreshold,
        kiThreshold: input.kiThreshold,
        maxUses: input.maxUses,
      };
      return "Uso de poções no farm automático atualizado.";
    case "shop.buy": {
      const offer = catalog.offers.find((o) => o.id === input.offerId);
      if (!offer) throw new GameError("NOT_FOUND", "Oferta inexistente.", 404);
      settlement(offer.settlementId);
      requireAllowed(offer.requirements);
      const item = catalog.items.find((i) => i.id === offer.itemId)!;
      requireAllowed(item.requirements);
      pay(offer.price * input.quantity);
      await addItem(item.id, input.quantity);
      return `Comprou ${input.quantity} × ${item.name}.`;
    }
    case "shop.sell": {
      settlement(input.settlementId);
      const item = catalog.items.find((i) => i.id === input.itemId);
      if (!item || !item.sellPrice)
        throw new GameError("NOT_SELLABLE", "Este item não pode ser vendido.");
      if (Object.values(c.equipment).includes(item.id)) {
        const inventory = await tx
          .select()
          .from(s.inventory)
          .where(eq(s.inventory.characterId, c.id));
        if ((inventory.find((i) => i.itemId === item.id)?.quantity ?? 0) - input.quantity < 1)
          throw new GameError(
            "ITEM_EQUIPPED",
            "Preserve a unidade equipada ou remova o equipamento.",
            409,
          );
      }
      await removeItem(item.id, input.quantity);
      c.zeni += item.sellPrice * input.quantity;
      return `Vendeu ${input.quantity} × ${item.name} por ${item.sellPrice * input.quantity} Zeni.`;
    }
    case "recipe.craft": {
      const recipe = catalog.recipes.find((r) => r.id === input.recipeId);
      if (!recipe) throw new GameError("NOT_FOUND", "Receita inexistente.", 404);
      settlement(recipe.settlementId);
      requireAllowed(recipe.requirements);
      requireAllowed(catalog.items.find((i) => i.id === recipe.outputItemId)!.requirements);
      pay(recipe.zeniCost * input.quantity);
      for (const ingredient of recipe.ingredients)
        await removeItem(ingredient.itemId, ingredient.quantity * input.quantity);
      await addItem(recipe.outputItemId, recipe.outputQuantity * input.quantity);
      return `${recipe.name}: ${recipe.outputQuantity * input.quantity} item(ns) recebido(s).`;
    }
    case "quest.claim": {
      const quest = catalog.quests.find((q) => q.id === input.questId);
      if (!quest) throw new GameError("NOT_FOUND", "Missão inexistente.", 404);
      requireAllowed(quest.requirements);
      let progress = c.questProgress?.find((p) => p.questId === quest.id);
      if (progress?.claimed)
        throw new GameError("ALREADY_CLAIMED", "Esta recompensa já foi recebida.", 409);
      const inventory = await tx
        .select()
        .from(s.inventory)
        .where(eq(s.inventory.characterId, c.id));
      if (!questReady(quest, progress, inventory))
        throw new GameError(
          "QUEST_INCOMPLETE",
          "Os objetivos da missão ainda não foram concluídos.",
          409,
        );
      for (const objective of quest.objectives)
        if (objective.kind === "deliver") await removeItem(objective.itemId, objective.quantity);
      if (!progress) {
        progress = { questId: quest.id, counters: {}, claimed: false };
        (c.questProgress ??= []).push(progress);
      }
      progress.claimed = true;
      c.flags = [...new Set([...c.flags, `quest:${quest.id}`, ...(quest.rewards.flags ?? [])])];
      grantExperience(c, quest.rewards.xp, race);
      c.zeni += quest.rewards.zeni;
      for (const item of quest.rewards.items ?? []) await addItem(item.itemId, item.quantity);
      c.campaignOrder = catalog.chapters.filter((ch) =>
        c.flags.includes(`quest:${ch.finaleQuestId}`),
      ).length;
      return `${quest.name} concluída: +${quest.rewards.xp} XP e +${quest.rewards.zeni} Zeni.`;
    }
    default:
      return null;
  }
}
