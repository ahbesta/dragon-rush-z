import "server-only";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { deriveStats } from "@/game/attributes";
import { applyExperience, xpRequired } from "@/game/progression";
import { unmetRequirements } from "@/game/requirements";
import { simulateBattle } from "@/game/combat";
import { actionInput, characterInput } from "@/game/validation";
import type {
  BattleResult,
  Catalog,
  CharacterState,
  GameSnapshot,
  ItemDefinition,
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
function statsFor(character: CharacterState, catalog: Catalog) {
  const equipped = Object.values(character.equipment)
    .map((id) => catalog.items.find((i) => i.id === id))
    .filter((i): i is ItemDefinition => Boolean(i));
  return deriveStats(character.base, character.level, equipped);
}
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
    const stats = deriveStats(race.base, 1);
    const [character] = await tx
      .insert(s.characters)
      .values({
        userId,
        name: input.name,
        raceId: race.id,
        base: race.base,
        hp: stats.maxHp,
        ki: stats.maxKi,
      })
      .returning();
    await tx.insert(s.learnedTechniques).values([
      { characterId: character.id, techniqueId: "soco" },
      { characterId: character.id, techniqueId: "chute" },
    ]);
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
  const limit = await consumeLimit(db, `game:${userId}`, 120, 60);
  if (!limit.allowed)
    throw new GameError("RATE_LIMIT", "Muitas ações. Aguarde alguns segundos.", 429);
  const hash = hashCommand(input);
  const random = options.random ?? secureRandom;
  return db.transaction(async (tx) => {
    const [character] = await tx
      .select()
      .from(s.characters)
      .where(eq(s.characters.userId, userId))
      .for("update");
    if (!character) return missing("Crie seu personagem primeiro.");
    const existingReceipt = await findReceipt(tx, userId, input.idempotencyKey, hash);
    if (existingReceipt) return existingReceipt;
    const now = await clock(tx);
    const catalog = await readCatalog(tx);
    const race =
      catalog.races.find((r) => r.id === character.raceId) ?? missing("Raça indisponível.");
    const [pending] = await tx
      .select()
      .from(s.activities)
      .where(and(eq(s.activities.characterId, character.id), isNull(s.activities.completedAt)));
    if (pending && input.action !== "activity.finish")
      throw new GameError(
        "ACTIVITY_PENDING",
        "Conclua a atividade atual antes de iniciar outra ação.",
        409,
        pending.finishesAt.toISOString(),
      );
    const result: Receipt = { message: "" };
    const policy = (id: string) =>
      catalog.policies.find((p) => p.id === id) ?? missing("Regras de atividade indisponíveis.");
    const stats = statsFor(character, catalog);
    switch (input.action) {
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
          const progress = applyExperience(
            character.level,
            character.xp,
            reward,
            character.base,
            race,
          );
          Object.assign(character, progress);
          result.message = `Treinamento concluído: +${reward} XP.`;
        }
        await tx
          .update(s.activities)
          .set({ completedAt: now })
          .where(eq(s.activities.id, pending.id));
        await appendHistory(tx, character.id, pending.kind, result.message);
        break;
      }
      case "explore":
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
          const encounters = catalog.encounters.filter((e) => e.areaId === area.id);
          if (input.action === "battle") {
            if (!encounters.some((e) => e.enemyId === input.enemyId))
              throw new GameError("INVALID_ENCOUNTER", "Inimigo não pertence à área.");
            enemyId = input.enemyId;
          } else {
            const total = encounters.reduce((sum, e) => sum + e.weight, 0);
            if (!total) return missing("Esta área não possui encontros.");
            let roll = random() * total;
            enemyId = encounters[encounters.length - 1].enemyId;
            for (const encounter of encounters) {
              roll -= encounter.weight;
              if (roll < 0) {
                enemyId = encounter.enemyId;
                break;
              }
            }
          }
        }
        const enemy =
          catalog.enemies.find((e) => e.id === enemyId) ?? missing("Inimigo não encontrado.");
        if (enemy.boss !== (input.action === "boss"))
          throw new GameError("INVALID_ENCOUNTER", "Use o encontro correto para este inimigo.");
        requireAllowed(character, catalog, enemy.requirements);
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
        const battle = simulateBattle({
          id: randomUUID(),
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
        });
        character.hp = battle.playerHp;
        character.ki = battle.playerKi;
        character.nextBattleAt = new Date(now.getTime() + policy("battle").durationSeconds * 1000);
        if (battle.outcome === "victory") {
          Object.assign(
            character,
            applyExperience(character.level, character.xp, battle.xp, character.base, race),
          );
          character.zeni += battle.zeni;
          character.flags = [...new Set([...character.flags, `defeated:${enemy.id}`])];
          for (const drop of battle.drops)
            await addItem(tx, character.id, drop.itemId, drop.quantity);
        }
        await tx
          .insert(s.battles)
          .values({
            id: battle.id,
            characterId: character.id,
            enemyId: enemy.id,
            result: battle,
            createdAt: now,
          });
        result.battle = battle;
        result.message =
          battle.outcome === "victory"
            ? `${enemy.name} derrotado! +${battle.xp} XP e +${battle.zeni} Zeni.`
            : battle.outcome === "defeat"
              ? `Derrota contra ${enemy.name}. Descanse e tente novamente.`
              : "Empate. Nenhuma recompensa concedida.";
        await appendHistory(tx, character.id, "battle", result.message);
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
          const hp = Math.min(
            stats.maxHp,
            character.hp + Math.floor(stats.maxHp * (item.effects.restoreHp ?? 0)),
          );
          const ki = Math.min(
            stats.maxKi,
            character.ki + Math.floor(stats.maxKi * (item.effects.restoreKi ?? 0)),
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
    }
    const finalStats = statsFor(character, catalog);
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
        flags: character.flags,
        nextBattleAt: character.nextBattleAt,
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
        now: string;
      };
      const result = await tx.execute<PersonalData>(sql`SELECT
      ${rowsAsJson(s.inventory, { where: eq(s.inventory.characterId, character.id) })} AS inventory,
      ${rowsAsJson(s.learnedTechniques, { where: eq(s.learnedTechniques.characterId, character.id) })} AS learned,
      ${rowsAsJson(s.unlockedTransformations, { where: eq(s.unlockedTransformations.characterId, character.id) })} AS unlocked,
      ${rowsAsJson(s.activities, { where: and(eq(s.activities.characterId, character.id), isNull(s.activities.completedAt)) })} AS activities,
      ${rowsAsJson(s.history, { where: eq(s.history.characterId, character.id), orderBy: sql`${s.history.createdAt} DESC`, limit: 10 })} AS history,
      ${rowsAsJson(s.battles, { where: eq(s.battles.characterId, character.id), orderBy: sql`${s.battles.createdAt} DESC`, limit: 1 })} AS battles,
      clock_timestamp() AS now`);
      const { inventory, learned, unlocked, activities, history, battles, now } = result.rows[0];
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
        stats: statsFor(character, catalog),
        xpRequired: xpRequired(character.level),
        race,
        catalog,
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
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
