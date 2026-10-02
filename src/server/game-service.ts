import "server-only";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { and, eq, isNull, sql, desc } from "drizzle-orm";
import {
  createExplorationSession,
  selectExplorationEvent,
  resolveExploration,
  finishExploration,
  presentExploration,
  explorationResult,
  ExplorationRuleError,
  isPendingExploration,
  advanceExploration,
  explorationEnemy,
  combineExplorationRewards,
  emptyExplorationReward,
} from "@/game/exploration/rules";
import type { ExplorationSession } from "@/game/exploration/types";
import { deriveBuildStats } from "@/game/attributes";
import { xpRequired } from "@/game/progression";
import { unmetRequirements } from "@/game/requirements";
import { createStrategicCombat, advanceStrategicCombat } from "@/game/strategic-combat";
import { requiresManualCombat } from "@/game/combat-access";
import { advanceQuests, defeatLoss, itemRecovery } from "@/game/economy";
import { buildAttributes, emptyAllocation } from "@/game/builds";
import { statsFor, upgradeCharacter, grantExperience } from "./character-rules";
import { executeWorldAction } from "./world-actions";
import { advanceCombat, CombatRuleError, finishCombat, presentCombat } from "@/game/combat";
import { actionInput, characterInput } from "@/game/validation";
import type {
  BattleResult,
  Catalog,
  CharacterState,
  CombatState,
  GameSnapshot,
} from "@/game/types";
import type { Db, Transaction } from "./db/client";
import * as s from "./db/schema";
import { readCatalog } from "./catalog";
import { GameError } from "./errors";
import { consumeLimit } from "./rate-limit";
import { rowsAsJson } from "./db/json-query";

type Receipt = { message: string; battle?: BattleResult };
const secureRandom = () => randomInt(0, 0x100000000) / 0x100000000;
const hashCommand = (input: unknown) =>
  createHash("sha256").update(JSON.stringify(input)).digest("hex");
const missing = (message: string): never => {
  throw new GameError("NOT_FOUND", message, 404);
};
async function clock(tx: Transaction): Promise<Date> {
  const result = await tx.execute<{ now: Date | string }>(sql`SELECT clock_timestamp() AS now`);
  return new Date(result.rows[0].now);
}
async function findReceipt(
  tx: Transaction,
  userId: string,
  key: string,
  hash: string,
): Promise<Receipt | null> {
  const [row] = await tx
    .select()
    .from(s.actionReceipts)
    .where(and(eq(s.actionReceipts.userId, userId), eq(s.actionReceipts.key, key)));
  if (!row) return null;
  if (row.hash !== hash)
    throw new GameError("KEY_CONFLICT", "Esta chave já foi usada para outra ação.", 409);
  return row.result;
}
async function saveReceipt(
  tx: Transaction,
  userId: string,
  key: string,
  hash: string,
  result: Receipt,
) {
  await tx.insert(s.actionReceipts).values({ userId, key, hash, result });
}
async function appendHistory(
  tx: Transaction,
  characterId: string,
  kind: string,
  description: string,
) {
  await tx.insert(s.history).values({ characterId, kind, description });
}
async function addItem(tx: Transaction, characterId: string, itemId: string, quantity: number) {
  await tx
    .insert(s.inventory)
    .values({ characterId, itemId, quantity })
    .onConflictDoUpdate({
      target: [s.inventory.characterId, s.inventory.itemId],
      set: { quantity: sql`${s.inventory.quantity} + ${quantity}` },
    });
}
async function removeItem(tx: Transaction, characterId: string, itemId: string, quantity: number) {
  const [owned] = await tx
    .select()
    .from(s.inventory)
    .where(and(eq(s.inventory.characterId, characterId), eq(s.inventory.itemId, itemId)));
  if (!Number.isSafeInteger(quantity) || quantity < 1 || !owned || owned.quantity < quantity)
    throw new GameError("NOT_OWNED", "Você não possui a quantidade necessária deste item.", 409);
  if (owned.quantity === quantity)
    await tx
      .delete(s.inventory)
      .where(and(eq(s.inventory.characterId, characterId), eq(s.inventory.itemId, itemId)));
  else
    await tx
      .update(s.inventory)
      .set({ quantity: owned.quantity - quantity })
      .where(and(eq(s.inventory.characterId, characterId), eq(s.inventory.itemId, itemId)));
}
async function consumeBattleItems(
  tx: Transaction,
  characterId: string,
  used: { itemId: string; quantity: number }[],
  previous: { itemId: string; quantity: number }[] = [],
) {
  for (const item of used) {
    const delta = item.quantity - (previous.find((p) => p.itemId === item.itemId)?.quantity ?? 0);
    if (delta > 0) await removeItem(tx, characterId, item.itemId, delta);
  }
}
function requireAllowed(
  character: CharacterState,
  catalog: Catalog,
  req: Parameters<typeof unmetRequirements>[0],
) {
  const reasons = unmetRequirements(req, {
    level: character.level,
    powerLevel: statsFor(character, catalog).powerLevel,
    raceId: character.raceId,
    flags: character.flags,
  });
  if (reasons.length)
    throw new GameError("REQUIREMENTS", `Requisitos pendentes: ${reasons.join("; ")}.`, 403);
}

export async function createCharacter(db: Db, userId: string, rawInput: unknown): Promise<Receipt> {
  const input = characterInput.parse(rawInput);
  const hash = hashCommand(input);
  return db.transaction(async (tx) => {
    const [owner] = await tx
      .select({ id: s.user.id })
      .from(s.user)
      .where(eq(s.user.id, userId))
      .for("update");
    if (!owner) throw new GameError("UNAUTHORIZED", "Faça login novamente.", 401);
    const existingReceipt = await findReceipt(tx, userId, input.idempotencyKey, hash);
    if (existingReceipt) return existingReceipt;
    const [existing] = await tx
      .select({ id: s.characters.id })
      .from(s.characters)
      .where(eq(s.characters.userId, userId));
    if (existing)
      throw new GameError("CHARACTER_EXISTS", "Sua conta já possui um personagem.", 409);
    const [race] = await tx.select().from(s.races).where(eq(s.races.id, input.raceId));
    if (!race) return missing("Raça não encontrada.");
    const base = buildAttributes(race, emptyAllocation());
    const stats = deriveBuildStats(base, 1);
    const [character] = await tx
      .insert(s.characters)
      .values({
        userId,
        name: input.name,
        raceId: race.id,
        base,
        rulesVersion: 2,
        ratedPower: stats.powerLevel,
        hp: stats.maxHp,
        ki: stats.maxKi,
      })
      .returning();
    await tx.insert(s.learnedTechniques).values([
      { characterId: character.id, techniqueId: "soco" },
      { characterId: character.id, techniqueId: "chute" },
    ]);
    await addItem(tx, character.id, "pocao-hp", 2);
    await addItem(tx, character.id, "pocao-ki", 1);
    await appendHistory(
      tx,
      character.id,
      "character",
      `${character.name} iniciou sua jornada como ${race.name}.`,
    );
    const result = { message: "Personagem criado. Sua jornada começa agora!" };
    await saveReceipt(tx, userId, input.idempotencyKey, hash, result);
    return result;
  });
}

export async function executeAction(
  db: Db,
  userId: string,
  rawInput: unknown,
  options: { random?: () => number } = {},
): Promise<Receipt> {
  const input = actionInput.parse(rawInput);
  const hash = hashCommand(input);
  const random = options.random ?? secureRandom;
  return db.transaction(async (tx) => {
    const [character] = await tx
      .select()
      .from(s.characters)
      .where(eq(s.characters.userId, userId))
      .for("update");
    if (!character) return missing("Crie seu personagem primeiro.");
    const limit = await consumeLimit(tx, `game:${userId}`, 120, 60);
    if (!limit.allowed)
      throw new GameError("RATE_LIMIT", "Muitas ações. Aguarde alguns segundos.", 429);
    const existingReceipt = await findReceipt(tx, userId, input.idempotencyKey, hash);
    if (existingReceipt) return existingReceipt;
    const now = await clock(tx);
    const catalog = await readCatalog(tx, {
      includeExplorationEvents: ["exploration.start", "exploration.advance", "explore"].includes(
        input.action,
      ),
    });
    const race =
      catalog.races.find((r) => r.id === character.raceId) ?? missing("Raça indisponível.");
    const [pending] = await tx
      .select()
      .from(s.activities)
      .where(and(eq(s.activities.characterId, character.id), isNull(s.activities.completedAt)));
    const [active] = await tx
      .select()
      .from(s.activeBattles)
      .where(eq(s.activeBattles.characterId, character.id));
    if (
      active &&
      input.action !== "battle.turn" &&
      input.action !== "battle.action" &&
      input.action !== "combat.mode"
    )
      throw new GameError(
        "BATTLE_PENDING",
        "Conclua o combate atual antes de iniciar outra ação.",
        409,
      );
    if (pending && input.action !== "activity.finish" && input.action !== "combat.mode")
      throw new GameError(
        "ACTIVITY_PENDING",
        "Conclua a atividade atual antes de iniciar outra ação.",
        409,
        pending.finishesAt.toISOString(),
      );
    const result: Receipt = { message: "" };
    let [exploration] = await tx
      .select()
      .from(s.explorationSessions)
      .where(
        and(
          eq(s.explorationSessions.characterId, character.id),
          isNull(s.explorationSessions.completedAt),
        ),
      );
    if (
      exploration &&
      ![
        "exploration.choose",
        "exploration.abandon",
        "exploration.advance",
        "exploration.return",
        "exploration.fight",
        "item.use",
        "combat.mode",
        "battle.turn",
        "battle.action",
      ].includes(input.action)
    )
      throw new GameError(
        "EXPLORATION_PENDING",
        "Resolva ou abandone o encontro de exploração antes de iniciar outra ação.",
        409,
      );
    if (!active) upgradeCharacter(character, race);
    const policy = (id: string) =>
      catalog.policies.find((p) => p.id === id) ?? missing("Regras de atividade indisponíveis.");
    const stats = statsFor(character, catalog);
    const explorationContext = async () => ({
      character,
      powerLevel: statsFor(character, catalog).powerLevel,
      maxHp: statsFor(character, catalog).maxHp,
      items: catalog.items,
      enemies: catalog.enemies,
      routes: catalog.explorationRoutes,
      inventory: await tx
        .select()
        .from(s.inventory)
        .where(eq(s.inventory.characterId, character.id)),
    });
    const persistExploration = async (state: ExplorationSession) => {
      if (!exploration)
        throw new GameError("ENCOUNTER_NOT_PENDING", "Encontro não encontrado.", 409);
      exploration.state = state;
      const finished = !isPendingExploration(state);
      await tx
        .update(s.explorationSessions)
        .set({ state, completedAt: finished ? now : null })
        .where(eq(s.explorationSessions.id, state.id));
      if (finished) {
        grantExperience(character, state.granted.xp, race);
        character.zeni += state.granted.zeni;
        character.flags = [...new Set([...character.flags, ...state.granted.flags])];
        for (const item of state.granted.items)
          await addItem(tx, character.id, item.itemId, item.quantity);
        await appendHistory(tx, character.id, "exploration", state.message);
      }
    };
    const completeBattle = async (
      battle: BattleResult,
      previousUsed: { itemId: string; quantity: number }[] = [],
    ) => {
      await consumeBattleItems(tx, character.id, battle.usedItems ?? [], previousUsed);
      const hpBeforeBattle = character.hp;
      const kiBeforeBattle = character.ki;
      character.hp = battle.playerHp;
      character.ki = battle.playerKi;
      const expeditionBattle =
        exploration?.state.status === "battle" && exploration.state.battleId === battle.id;
      if (battle.outcome === "victory") {
        if (!expeditionBattle) {
          grantExperience(character, battle.xp, race);
          character.zeni += battle.zeni;
          for (const drop of battle.drops)
            await addItem(tx, character.id, drop.itemId, drop.quantity);
        }
        character.flags = [...new Set([...character.flags, `defeated:${battle.enemyId}`])];

        if (battle.version === 2)
          advanceQuests(
            character,
            catalog.quests,
            { kind: "defeat", enemyId: battle.enemyId },
            (q) =>
              unmetRequirements(q.requirements, {
                level: character.level,
                powerLevel: statsFor(character, catalog).powerLevel,
                raceId: character.raceId,
                flags: character.flags,
              }).length === 0,
          );
      } else if (battle.outcome === "defeat" && battle.version === 2) {
        battle.zeniLost = defeatLoss(character.zeni);
        character.zeni -= battle.zeniLost;
      }
      await tx.insert(s.battles).values({
        id: battle.id,
        characterId: character.id,
        enemyId: battle.enemyId,
        result: battle,
        createdAt: now,
      });
      await tx.delete(s.activeBattles).where(eq(s.activeBattles.characterId, character.id));
      if (expeditionBattle && exploration) {
        const state = structuredClone(exploration.state);
        state.revision++;
        state.feedback = {
          id: `${state.id}:${state.revision}`,
          kind: battle.outcome === "victory" ? "gain" : "loss",
          title:
            battle.outcome === "victory" ? "Emboscada vencida!" : "A emboscada levou seus achados!",
          message:
            battle.outcome === "victory"
              ? "Você sobreviveu. Recompensas e achados continuam em risco até voltar em segurança."
              : "Os achados de todos os trechos foram perdidos. As provisões utilizadas não são devolvidas.",
          gained:
            battle.outcome === "victory"
              ? { items: battle.drops, xp: battle.xp, zeni: battle.zeni, flags: [] }
              : emptyExplorationReward(),
          lost:
            battle.outcome === "victory"
              ? emptyExplorationReward()
              : structuredClone(state.pending),
          hpLost: Math.max(0, hpBeforeBattle - battle.playerHp),
          kiSpent: Math.max(0, kiBeforeBattle - battle.playerKi),
          zeniSpent: 0,
          zeniLost: battle.zeniLost ?? 0,
          spentItems: battle.usedItems ?? [],
        };
        if (battle.outcome === "victory") {
          state.pending = combineExplorationRewards(state.pending, state.feedback.gained);
          state.status = "checkpoint";
          state.message = state.feedback.message;
          state.log.push(state.message);
          await persistExploration(state);
        } else await persistExploration(finishExploration(state, "failed", state.feedback.message));
      }
      result.battle = battle;
      const enemyName = catalog.enemies.find((e) => e.id === battle.enemyId)?.name ?? "Inimigo";
      result.message =
        battle.outcome === "victory"
          ? `${enemyName} derrotado! +${battle.xp} XP e +${battle.zeni} Zeni.`
          : battle.outcome === "defeat"
            ? `Derrota contra ${enemyName}. ${battle.zeniLost ?? 0} Zeni perdidos. Os consumíveis usados foram gastos. Descanse e prepare-se.`
            : "Empate. Nenhuma recompensa concedida.";
      await appendHistory(tx, character.id, "battle", result.message);
    };
    const engage = async (enemy: Catalog["enemies"][number], areaId?: string) => {
      const learned = await tx
        .select()
        .from(s.learnedTechniques)
        .where(eq(s.learnedTechniques.characterId, character.id));
      const available = character.selectedTechniques.filter((id) =>
        learned.some((t) => t.techniqueId === id),
      );
      const playerTechniques = available
        .map((id) => catalog.techniques.find((t) => t.id === id))
        .filter((t): t is Catalog["techniques"][number] => Boolean(t));
      const combatInventory = await tx
        .select()
        .from(s.inventory)
        .where(eq(s.inventory.characterId, character.id));
      const combat = createStrategicCombat({
        id: randomUUID(),
        areaId,
        player: {
          name: character.name,
          hp: character.hp,
          ki: character.ki,
          stats,
          techniques: playerTechniques,
        },
        enemy,
        techniques: catalog.techniques,
        drops: catalog.drops,
        random,
        playerLevel: character.level,
        belt: character.belt ?? [],
        inventory: combatInventory,
        items: catalog.items,
        autoItems: character.autoItems ?? {
          enabled: false,
          hpThreshold: 30,
          kiThreshold: 20,
          maxUses: 1,
        },
      });
      if (exploration?.state.status === "battle") {
        exploration.state.battleId = combat.id;
        await persistExploration(exploration.state);
      }
      if (character.combatMode === "manual" || requiresManualCombat(enemy, character.flags)) {
        await tx.insert(s.activeBattles).values({
          id: combat.id,
          characterId: character.id,
          state: combat,
          createdAt: now,
          updatedAt: now,
        });
        result.message = `Combate contra ${enemy.name} iniciado. Escolha sua técnica.`;
        await appendHistory(tx, character.id, "battle.start", result.message);
      } else await completeBattle(finishCombat(combat, random));
    };
    switch (input.action) {
      case "exploration.advance":
      case "exploration.return":
      case "exploration.fight": {
        if (
          !exploration ||
          exploration.id !== input.encounterId ||
          exploration.state.revision !== input.revision
        )
          throw new GameError("STALE_ENCOUNTER", "O trecho mudou. Atualize a exploração.", 409);
        const state = structuredClone(exploration.state);
        try {
          if (input.action === "exploration.return") {
            if (!["active", "checkpoint"].includes(state.status))
              throw new GameError(
                "CANNOT_RETURN",
                "A emboscada bloqueou sua saída. Enfrente o inimigo primeiro.",
                409,
              );
            state.revision++;
            await persistExploration(
              finishExploration(
                state,
                "success",
                "Você voltou em segurança. Todos os achados da expedição foram guardados.",
              ),
            );
          } else if (input.action === "exploration.advance") {
            if (state.status !== "checkpoint")
              throw new GameError("CANNOT_ADVANCE", "Resolva o encontro antes de avançar.", 409);
            if (character.hp <= 0)
              throw new GameError("NO_HP", "Recupere seu HP antes de avançar.", 409);
            if (character.nextBattleAt && now < character.nextBattleAt)
              throw new GameError(
                "COOLDOWN",
                "Recupere o fôlego antes de avançar.",
                409,
                character.nextBattleAt.toISOString(),
              );
            const route = catalog.explorationRoutes?.find((r) => r.id === state.routeId);
            const ctx = await explorationContext();
            ctx.character = { ...character, flags: [...character.flags, ...state.pending.flags] };
            const event = selectExplorationEvent(
              catalog.explorationEvents ?? [],
              state.areaId,
              ctx,
              random,
              route,
              (state.depth ?? 1) + 1,
            );
            const advanced = advanceExploration(state, event, stats, random, character.ki);
            character.ki -= advanced.cost;
            await persistExploration(advanced.session);
          } else {
            if (state.status !== "ambush")
              throw new GameError("NO_AMBUSH", "Não há uma emboscada aguardando combate.", 409);
            const enemy =
              catalog.enemies.find((e) => e.id === state.enemyId) ??
              missing("Inimigo indisponível.");
            if (
              enemy.boss ||
              !catalog.encounters.some((e) => e.areaId === state.areaId && e.enemyId === enemy.id)
            )
              throw new GameError("INVALID_ENCOUNTER", "Emboscada inválida.", 409);
            requireAllowed(character, catalog, enemy.requirements);
            state.status = "battle";
            state.revision++;
            await persistExploration(state);
            await engage(explorationEnemy(enemy, state.depth ?? 1), state.areaId);
          }
        } catch (error) {
          if (error instanceof ExplorationRuleError)
            throw new GameError(error.code, error.message, 409);
          throw error;
        }
        if (!result.battle)
          result.message = exploration.state.message || "Sua decisão foi registrada.";
        break;
      }
      case "explore":
      case "exploration.start": {
        if (character.hp <= 0)
          throw new GameError("NO_HP", "Descanse ou use uma poção antes de explorar.", 409);
        if (character.nextBattleAt && now < character.nextBattleAt)
          throw new GameError(
            "COOLDOWN",
            "Recupere o fôlego antes de explorar.",
            409,
            character.nextBattleAt.toISOString(),
          );
        const area =
          catalog.areas.find((a) => a.id === input.areaId) ?? missing("Área não encontrada.");
        if (character.level < area.minLevel)
          throw new GameError("AREA_LOCKED", `Esta área exige nível ${area.minLevel}.`, 403);
        requireAllowed(character, catalog, { ...area.requirements, minLevel: area.minLevel });
        const [previous] = await tx
          .select()
          .from(s.explorationSessions)
          .where(eq(s.explorationSessions.characterId, character.id))
          .orderBy(desc(s.explorationSessions.startedAt))
          .limit(1);
        const deadline = previous
          ? new Date(previous.startedAt.getTime() + policy("exploration").durationSeconds * 1000)
          : null;
        if (deadline && now < deadline)
          throw new GameError(
            "COOLDOWN",
            "Aguarde antes de procurar um novo encontro.",
            409,
            deadline.toISOString(),
          );
        const routeId = input.action === "exploration.start" ? input.routeId : undefined;
        const route = routeId
          ? catalog.explorationRoutes?.find((r) => r.id === routeId && r.areaId === area.id)
          : undefined;
        if (routeId && (!route || !character.flags.includes(route.discoveryFlag)))
          throw new GameError(
            "ROUTE_LOCKED",
            "Este caminho ainda não foi descoberto nesta região.",
            403,
          );
        try {
          const event = selectExplorationEvent(
            catalog.explorationEvents ?? [],
            area.id,
            await explorationContext(),
            random,
            route,
          );
          const state = createExplorationSession(
            event,
            randomUUID(),
            stats,
            random,
            route?.id ?? null,
          );
          [exploration] = await tx
            .insert(s.explorationSessions)
            .values({ id: state.id, characterId: character.id, state, startedAt: now })
            .returning();
          result.message = `Encontro: ${event.title}. Escolha como agir.`;
        } catch (error) {
          if (error instanceof ExplorationRuleError)
            throw new GameError(error.code, error.message, 409);
          throw error;
        }
        break;
      }
      case "exploration.choose":
      case "exploration.abandon": {
        if (
          !exploration ||
          exploration.id !== input.encounterId ||
          !["active", "checkpoint"].includes(exploration.state.status) ||
          exploration.state.revision !== input.revision
        )
          throw new GameError(
            "STALE_ENCOUNTER",
            "O encontro mudou ou já foi resolvido. Atualize a tela.",
            409,
          );
        if (input.action === "exploration.abandon") {
          await persistExploration(
            finishExploration(
              exploration.state,
              "abandoned",
              "Você abandonou o encontro. Achados pendentes foram perdidos; custos já gastos não são devolvidos.",
            ),
          );
        } else {
          try {
            const resolved = resolveExploration(
              exploration.state,
              input.revision,
              input.choiceId,
              await explorationContext(),
            );
            character.ki -= resolved.cost?.ki ?? 0;
            character.zeni -= resolved.cost?.zeni ?? 0;
            for (const item of resolved.cost?.items ?? [])
              await removeItem(tx, character.id, item.itemId, item.quantity);
            character.hp = Math.max(0, character.hp - resolved.damage);
            const state =
              character.hp === 0
                ? finishExploration(
                    resolved.session,
                    "failed",
                    "Você foi derrotado pelo perigo. Os achados foram perdidos. Recupere-se antes de continuar.",
                  )
                : resolved.session;
            await persistExploration(state);
          } catch (error) {
            if (error instanceof ExplorationRuleError)
              throw new GameError(error.code, error.message, 409);
            throw error;
          }
        }
        result.message = exploration.state.message || "Sua escolha foi registrada.";
        break;
      }
      case "combat.mode": {
        character.combatMode = input.mode;
        if (
          active &&
          input.mode === "automatic" &&
          !requiresManualCombat(active.state.definition, character.flags)
        ) {
          await completeBattle(finishCombat(active.state, random), active.state.strategic?.used);
        } else {
          result.message =
            input.mode === "manual"
              ? "Combate manual selecionado. Você escolhe cada técnica."
              : active && requiresManualCombat(active.state.definition, character.flags)
                ? "Automático selecionado. Vença este desafio manualmente uma vez para liberar o farm automático."
                : "Combate automático selecionado.";
        }
        break;
      }
      case "battle.turn":
      case "battle.action": {
        if (!active || active.id !== input.battleId)
          throw new GameError("BATTLE_NOT_PENDING", "Este combate não está em andamento.", 409);
        if (input.round !== active.state.round + 1)
          throw new GameError(
            "STALE_TURN",
            "Esta rodada já foi resolvida. Atualize o combate.",
            409,
          );
        let next: CombatState;
        try {
          next =
            input.action === "battle.action"
              ? advanceStrategicCombat(active.state, input.command, random)
              : advanceCombat(active.state, input.techniqueId, random);
        } catch (error) {
          if (error instanceof CombatRuleError) throw new GameError(error.code, error.message, 409);
          throw error;
        }
        if (next.result) await completeBattle(next.result, active.state.strategic?.used);
        else {
          await consumeBattleItems(
            tx,
            character.id,
            next.strategic?.used ?? [],
            active.state.strategic?.used,
          );
          character.hp = next.player.hp;
          character.ki = next.player.ki;
          await tx
            .update(s.activeBattles)
            .set({ state: next, updatedAt: now })
            .where(eq(s.activeBattles.id, active.id));
          result.message = `Rodada ${next.round} resolvida. Escolha sua próxima técnica.`;
        }
        break;
      }
      case "training.start":
      case "rest.start": {
        const kind = input.action === "training.start" ? "training" : "rest";
        const rule = policy(kind);
        const [activity] = await tx
          .insert(s.activities)
          .values({
            characterId: character.id,
            kind,
            startedAt: now,
            finishesAt: new Date(now.getTime() + rule.durationSeconds * 1000),
          })
          .returning();
        result.message =
          kind === "training"
            ? "Treinamento iniciado. Concentre seu Ki!"
            : "Descanso iniciado. Recupere suas forças.";
        await appendHistory(
          tx,
          character.id,
          kind,
          `${result.message} Duração: ${rule.durationSeconds}s.`,
        );
        if (!activity) throw new Error("Falha ao persistir atividade");
        break;
      }
      case "activity.finish": {
        if (!pending || pending.id !== input.activityId)
          throw new GameError(
            "ACTIVITY_NOT_PENDING",
            "Atividade inexistente ou já concluída.",
            409,
          );
        if (now < pending.finishesAt)
          throw new GameError(
            "COOLDOWN",
            "A atividade ainda não terminou.",
            409,
            pending.finishesAt.toISOString(),
          );
        if (pending.kind === "rest") {
          character.hp = stats.maxHp;
          character.ki = stats.maxKi;
          result.message = "Descanso concluído. HP e Ki restaurados.";
        } else {
          const reward = policy("training").xpReward;
          grantExperience(character, reward, race);
          advanceQuests(
            character,
            catalog.quests,
            { kind: "train" },
            (q) =>
              unmetRequirements(q.requirements, {
                level: character.level,
                powerLevel: statsFor(character, catalog).powerLevel,
                raceId: character.raceId,
                flags: character.flags,
              }).length === 0,
          );
          result.message = `Treinamento concluído: +${reward} XP.`;
        }
        await tx
          .update(s.activities)
          .set({ completedAt: now })
          .where(eq(s.activities.id, pending.id));
        await appendHistory(tx, character.id, pending.kind, result.message);
        break;
      }
      case "battle":
      case "boss": {
        if (character.hp <= 0)
          throw new GameError("NO_HP", "Você foi derrotado. Descanse ou use uma Poção de HP.", 409);
        if (character.nextBattleAt && now < character.nextBattleAt)
          throw new GameError(
            "COOLDOWN",
            "Prepare-se para o próximo combate.",
            409,
            character.nextBattleAt.toISOString(),
          );
        let enemyId: string;
        if (input.action === "boss") {
          enemyId = input.enemyId;
        } else {
          const area =
            catalog.areas.find((a) => a.id === input.areaId) ?? missing("Área não encontrada.");
          if (character.level < area.minLevel)
            throw new GameError("AREA_LOCKED", `Esta área exige nível ${area.minLevel}.`, 403);
          requireAllowed(character, catalog, area.requirements ?? {});
          const encounters = catalog.encounters.filter((e) => e.areaId === area.id);
          if (!encounters.some((e) => e.enemyId === input.enemyId))
            throw new GameError("INVALID_ENCOUNTER", "Inimigo não pertence à área.");
          enemyId = input.enemyId;
        }
        const enemy =
          catalog.enemies.find((e) => e.id === enemyId) ?? missing("Inimigo não encontrado.");
        if (enemy.boss !== (input.action === "boss"))
          throw new GameError("INVALID_ENCOUNTER", "Use o encontro correto para este inimigo.");
        requireAllowed(character, catalog, enemy.requirements);
        const bossArea =
          input.action === "boss"
            ? catalog.areas.find(
                (a) =>
                  a.id ===
                  catalog.encounters.find((e) => e.enemyId === (enemy.heroicOf ?? enemy.id))
                    ?.areaId,
              )
            : undefined;
        if (bossArea) {
          if (character.level < bossArea.minLevel)
            throw new GameError("AREA_LOCKED", `Esta área exige nível ${bossArea.minLevel}.`, 403);
          requireAllowed(character, catalog, bossArea.requirements ?? {});
        }
        await engage(enemy, input.action === "boss" ? bossArea?.id : input.areaId);
        break;
      }
      case "item.use":
      case "equipment.equip": {
        const item =
          catalog.items.find((i) => i.id === input.itemId) ?? missing("Item não encontrado.");
        const [owned] = await tx
          .select()
          .from(s.inventory)
          .where(and(eq(s.inventory.characterId, character.id), eq(s.inventory.itemId, item.id)));
        if (!owned || owned.quantity < 1)
          throw new GameError("NOT_OWNED", "Você não possui este item.", 403);
        requireAllowed(character, catalog, item.requirements);
        if (input.action === "equipment.equip") {
          if (item.type !== "equipment" || !item.slot)
            throw new GameError("INVALID_ITEM", "Este item não pode ser equipado.");
          if (character.equipment[item.slot] === item.id)
            throw new GameError("ALREADY_EQUIPPED", "Este item já está equipado.", 409);
          character.equipment = { ...character.equipment, [item.slot]: item.id };
          result.message = `${item.name} equipado.`;
        } else {
          if (item.type !== "consumable")
            throw new GameError("INVALID_ITEM", "Este item não é consumível.");
          if (item.effects.kiDamageBuff || (item.effects.cure?.length && !item.effects.restoreHp))
            throw new GameError(
              "BATTLE_ONLY",
              "Use este item pela bolsa durante uma batalha.",
              409,
            );
          const { hp, ki } = itemRecovery(
            character.hp,
            character.ki,
            stats.maxHp,
            stats.maxKi,
            item,
          );
          if (hp === character.hp && ki === character.ki)
            throw new GameError(
              "NO_EFFECT",
              "Seus recursos já estão completos. Item preservado.",
              409,
            );
          character.hp = hp;
          character.ki = ki;
          const where = and(
            eq(s.inventory.characterId, character.id),
            eq(s.inventory.itemId, item.id),
          );
          if (owned.quantity === 1) await tx.delete(s.inventory).where(where);
          else
            await tx
              .update(s.inventory)
              .set({ quantity: owned.quantity - 1 })
              .where(where);
          result.message = `${item.name} utilizado.`;
        }
        await appendHistory(tx, character.id, "item", result.message);
        break;
      }
      case "equipment.unequip": {
        if (!character.equipment[input.slot])
          throw new GameError("EMPTY_SLOT", "Slot já está vazio.", 409);
        character.equipment = { ...character.equipment };
        delete character.equipment[input.slot];
        result.message = "Equipamento removido.";
        await appendHistory(tx, character.id, "item", result.message);
        break;
      }
      case "technique.learn": {
        const technique =
          catalog.techniques.find((t) => t.id === input.techniqueId) ??
          missing("Técnica não encontrada.");
        const [learned] = await tx
          .select()
          .from(s.learnedTechniques)
          .where(
            and(
              eq(s.learnedTechniques.characterId, character.id),
              eq(s.learnedTechniques.techniqueId, technique.id),
            ),
          );
        if (learned) throw new GameError("ALREADY_LEARNED", "Você já conhece esta técnica.", 409);
        requireAllowed(character, catalog, technique.requirements);
        if (character.zeni < technique.learnCost)
          throw new GameError("NOT_ENOUGH_ZENI", "Zeni insuficiente.", 409);
        character.zeni -= technique.learnCost;
        await tx
          .insert(s.learnedTechniques)
          .values({ characterId: character.id, techniqueId: technique.id });
        character.selectedTechniques = [technique.id, ...character.selectedTechniques].slice(0, 3);
        result.message = `${technique.name} aprendida e adicionada à prioridade de combate!`;
        await appendHistory(tx, character.id, "technique", result.message);
        break;
      }
      case "technique.select": {
        const learned = await tx
          .select()
          .from(s.learnedTechniques)
          .where(eq(s.learnedTechniques.characterId, character.id));
        if (input.techniqueIds.some((id) => !learned.some((t) => t.techniqueId === id)))
          throw new GameError(
            "TECHNIQUE_LOCKED",
            "Você só pode selecionar técnicas aprendidas.",
            403,
          );
        character.selectedTechniques = input.techniqueIds;
        result.message = "Prioridade de técnicas atualizada.";
        break;
      }
      default: {
        const message = await executeWorldAction(input, {
          tx,
          character,
          catalog,
          race,
          requireAllowed: (req) => requireAllowed(character, catalog, req),
          addItem: (id, q) => addItem(tx, character.id, id, q),
          removeItem: (id, q) => removeItem(tx, character.id, id, q),
        });
        if (!message) throw new GameError("INVALID_ACTION", "Ação indisponível.");
        result.message = message;
        await appendHistory(tx, character.id, input.action, message);
      }
    }
    const [remainingActive] = await tx
      .select({ id: s.activeBattles.id })
      .from(s.activeBattles)
      .where(eq(s.activeBattles.characterId, character.id));
    if (!remainingActive) upgradeCharacter(character, race);
    const finalStats = statsFor(character, catalog);
    if (result.battle)
      character.nextBattleAt = new Date(
        (await clock(tx)).getTime() + policy("battle").durationSeconds * 1000,
      );
    await tx
      .update(s.characters)
      .set({
        level: character.level,
        xp: character.xp,
        zeni: character.zeni,
        hp: Math.min(character.hp, finalStats.maxHp),
        ki: Math.min(character.ki, finalStats.maxKi),
        base: character.base,
        equipment: character.equipment,
        selectedTechniques: character.selectedTechniques,
        combatMode: character.combatMode,
        flags: character.flags,
        nextBattleAt: character.nextBattleAt,
        rulesVersion: character.rulesVersion,
        allocation: character.allocation,
        respecCount: character.respecCount,
        belt: character.belt,
        autoItems: character.autoItems,
        questProgress: character.questProgress,
        ratedPower: finalStats.powerLevel,
        campaignOrder: character.campaignOrder,
        updatedAt: now,
      })
      .where(and(eq(s.characters.id, character.id), eq(s.characters.userId, userId)));
    await saveReceipt(tx, userId, input.idempotencyKey, hash, result);
    return result;
  });
}

export async function readSnapshot(db: Db, userId: string): Promise<GameSnapshot | null> {
  return db.transaction(
    async (tx) => {
      const [character] = await tx
        .select()
        .from(s.characters)
        .where(eq(s.characters.userId, userId));
      if (!character) return null;
      const catalog = await readCatalog(tx);
      const race =
        catalog.races.find((r) => r.id === character.raceId) ?? missing("Raça indisponível.");
      type PersonalData = {
        inventory: { itemId: string; quantity: number }[];
        learned: { techniqueId: string }[];
        unlocked: { transformationId: string }[];
        activities: { id: string; kind: "training" | "rest"; finishesAt: string }[];
        history: GameSnapshot["history"];
        battles: { result: BattleResult }[];
        active: { state: CombatState }[];
        explorations: {
          state: ExplorationSession;
          startedAt: string;
          completedAt: string | null;
        }[];
        explorationHistory: { state: ExplorationSession }[];
        now: string;
      };
      const result = await tx.execute<PersonalData>(sql`SELECT
      ${rowsAsJson(s.inventory, { where: eq(s.inventory.characterId, character.id) })} AS inventory,
      ${rowsAsJson(s.learnedTechniques, { where: eq(s.learnedTechniques.characterId, character.id) })} AS learned,
      ${rowsAsJson(s.unlockedTransformations, { where: eq(s.unlockedTransformations.characterId, character.id) })} AS unlocked,
      ${rowsAsJson(s.activities, { where: and(eq(s.activities.characterId, character.id), isNull(s.activities.completedAt)) })} AS activities,
      ${rowsAsJson(s.history, { where: eq(s.history.characterId, character.id), orderBy: sql`${s.history.createdAt} DESC`, limit: 10 })} AS history,
      ${rowsAsJson(s.battles, { where: eq(s.battles.characterId, character.id), orderBy: sql`${s.battles.createdAt} DESC`, limit: 1 })} AS battles,
      ${rowsAsJson(s.activeBattles, { where: eq(s.activeBattles.characterId, character.id) })} AS active,
      ${rowsAsJson(s.explorationSessions, { where: eq(s.explorationSessions.characterId, character.id), orderBy: sql`${s.explorationSessions.startedAt} DESC`, limit: 1 })} AS explorations,
      ${rowsAsJson(s.explorationSessions, { where: and(eq(s.explorationSessions.characterId, character.id), sql`${s.explorationSessions.completedAt} IS NOT NULL`), orderBy: sql`${s.explorationSessions.startedAt} DESC`, limit: 1 })} AS "explorationHistory",
      clock_timestamp() AS now`);
      const {
        inventory,
        learned,
        unlocked,
        activities,
        history,
        battles,
        active,
        explorations,
        explorationHistory,
        now,
      } = result.rows[0];
      if (!active.length) upgradeCharacter(character, race);
      const displayedStats = statsFor(character, catalog);
      character.hp = Math.min(character.hp, displayedStats.maxHp);
      character.ki = Math.min(character.ki, displayedStats.maxKi);
      const {
        userId: _owner,
        createdAt: _created,
        updatedAt: _updated,
        ...publicCharacter
      } = character;
      void _owner;
      void _created;
      void _updated;
      return {
        serverTime: new Date(now).toISOString(),
        character: {
          ...publicCharacter,
          nextBattleAt: character.nextBattleAt?.toISOString() ?? null,
        },
        stats: displayedStats,
        xpRequired: xpRequired(character.level),
        race,
        catalog: { ...catalog, explorationEvents: undefined },
        activeExploration:
          explorations[0] && !explorations[0].completedAt
            ? presentExploration(explorations[0].state, {
                character,
                powerLevel: displayedStats.powerLevel,
                maxHp: displayedStats.maxHp,
                inventory,
                items: catalog.items,
                enemies: catalog.enemies,
                routes: catalog.explorationRoutes,
              })
            : null,
        latestExploration: explorationHistory[0]
          ? explorationResult(explorationHistory[0].state)
          : null,
        explorationCooldownAt: explorations[0]
          ? new Date(
              new Date(explorations[0].startedAt).getTime() +
                (catalog.policies.find((p) => p.id === "exploration")?.durationSeconds ?? 12) *
                  1000,
            ).toISOString()
          : null,
        inventory: inventory.map((i) => ({ itemId: i.itemId, quantity: i.quantity })),
        learnedTechniques: learned.map((t) => t.techniqueId),
        unlockedTransformations: unlocked.map((t) => t.transformationId),
        activity: activities[0]
          ? {
              id: activities[0].id,
              kind: activities[0].kind,
              finishesAt: new Date(activities[0].finishesAt).toISOString(),
            }
          : null,
        history: history.map((h) => ({
          id: h.id,
          kind: h.kind,
          description: h.description,
          createdAt: new Date(h.createdAt).toISOString(),
        })),
        latestBattle: battles[0]?.result ?? null,
        activeBattle: active[0] ? presentCombat(active[0].state, character.flags) : null,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
