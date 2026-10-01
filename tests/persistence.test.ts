import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq, sql } from "drizzle-orm";
import { createDatabase, type Database } from "@/server/db/client";
import { seedDatabase } from "@/server/db/seed";
import * as s from "@/server/db/schema";
import { createCharacter, executeAction, readSnapshot } from "@/server/game-service";
import { consumeLimit } from "@/server/rate-limit";
import { actionInput } from "@/game/validation";
import { emptyAllocation, spentPoints } from "@/game/builds";
import { createCombat } from "@/game/combat";
import { deriveStats } from "@/game/attributes";
import { legacyCatalog } from "@/server/db/legacy-catalog";
import { readRanking } from "@/server/ranking";
import { buildAttributes } from "@/game/builds";
vi.mock("server-only", () => ({}));
let engine: PGlite;
let server: PGLiteSocketServer;
let database: Database;
let owner: string;
const command = (action: unknown) =>
  executeAction(
    database.db,
    owner,
    actionInput.parse({ ...(action as object), idempotencyKey: randomUUID() }),
    { random: () => 0.1 },
  );
beforeAll(async () => {
  engine = await PGlite.create();
  server = new PGLiteSocketServer({
    db: engine,
    host: "127.0.0.1",
    port: 54330,
    maxConnections: 8,
  });
  await server.start();
  database = createDatabase("postgresql://postgres:postgres@127.0.0.1:54330/postgres");
  await migrate(database.db, { migrationsFolder: "./drizzle" });
  await database.db.transaction(seedDatabase);
}, 60000);
beforeEach(async () => {
  await database.db.execute(sql`TRUNCATE auth_user CASCADE`);
  await database.db.execute(sql`TRUNCATE rate_limit`);
  owner = randomUUID();
  await database.db
    .insert(s.user)
    .values({ id: owner, name: "Teste", email: `${owner}@example.test` });
  await createCharacter(database.db, owner, {
    name: "Rafael",
    raceId: "saiyajin",
    idempotencyKey: randomUUID(),
  });
});
afterAll(async () => {
  if (database) await database.pool.end();
  if (server) await server.stop();
  if (engine) await engine.close();
});
describe("Persistência PostgreSQL e transações", () => {
  it("migrations e seed são repetíveis sem duplicar catálogos", async () => {
    await migrate(database.db, { migrationsFolder: "./drizzle" });
    await database.db.transaction(seedDatabase);
    expect(await database.db.select().from(s.races)).toHaveLength(5);
    expect(await database.db.select().from(s.enemies)).toHaveLength(49);
    expect(await database.db.select().from(s.characters)).toHaveLength(1);
  });
  it("criação concorrente não gera um segundo personagem", async () => {
    const results = await Promise.allSettled(
      [0, 1, 2].map(() =>
        createCharacter(database.db, owner, {
          name: "Outro",
          raceId: "humano",
          idempotencyKey: randomUUID(),
        }),
      ),
    );
    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(await database.db.select().from(s.characters)).toHaveLength(1);
  });
  it("treino não pode terminar antes do relógio do banco", async () => {
    await command({ action: "training.start" });
    const snap = (await readSnapshot(database.db, owner))!;
    await expect(
      command({ action: "activity.finish", activityId: snap.activity!.id }),
    ).rejects.toMatchObject({ code: "COOLDOWN" });
    await expect(command({ action: "training.start" })).rejects.toMatchObject({
      code: "ACTIVITY_PENDING",
    });
    expect((await readSnapshot(database.db, owner))!.character.xp).toBe(0);
  });
  it("conclusão concorrente e repetida concede XP uma vez", async () => {
    await command({ action: "training.start" });
    const snap = (await readSnapshot(database.db, owner))!;
    await database.db
      .update(s.activities)
      .set({ finishesAt: new Date(0) })
      .where(eq(s.activities.id, snap.activity!.id));
    const action = {
      action: "activity.finish",
      activityId: snap.activity!.id,
      idempotencyKey: randomUUID(),
    };
    const results = await Promise.all(
      [0, 1, 2].map(() => executeAction(database.db, owner, action)),
    );
    expect(results[0]).toEqual(results[1]);
    expect((await readSnapshot(database.db, owner))!.character.xp).toBe(10);
    await expect(
      command({ action: "activity.finish", activityId: snap.activity!.id }),
    ).rejects.toMatchObject({ code: "ACTIVITY_NOT_PENDING" });
  });
  it("combate repetido concede XP, Zeni e drop uma vez", async () => {
    const input = {
      action: "battle",
      areaId: "floresta",
      enemyId: "lobo",
      idempotencyKey: randomUUID(),
    };
    const results = await Promise.all(
      [0, 1, 2].map(() => executeAction(database.db, owner, input, { random: () => 0.1 })),
    );
    expect(results[0].battle!.id).toBe(results[2].battle!.id);
    const snap = (await readSnapshot(database.db, owner))!;
    expect(snap.character.xp).toBe(28);
    expect(snap.character.zeni).toBe(63);
    expect(snap.inventory).toEqual(
      expect.arrayContaining([
        { itemId: "pocao-hp", quantity: 3 },
        { itemId: "erva", quantity: 1 },
        { itemId: "fruto-ki", quantity: 1 },
      ]),
    );
    expect(await database.db.select().from(s.battles)).toHaveLength(1);
  });
  it("duas batalhas diferentes simultâneas respeitam cooldown", async () => {
    const results = await Promise.allSettled(
      [0, 1].map(() => command({ action: "battle", areaId: "floresta", enemyId: "lobo" })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "COOLDOWN" },
    });
    expect(await database.db.select().from(s.battles)).toHaveLength(1);
  });
  it("reutilizar chave com outro comando é rejeitado", async () => {
    const key = randomUUID();
    await executeAction(database.db, owner, { action: "training.start", idempotencyKey: key });
    await expect(
      executeAction(database.db, owner, { action: "rest.start", idempotencyKey: key }),
    ).rejects.toMatchObject({ code: "KEY_CONFLICT" });
  });
  it("aprendizado exige nível e mestre e não permite técnicas de terceiros", async () => {
    await expect(
      command({ action: "technique.learn", techniqueId: "rajada-ki" }),
    ).rejects.toMatchObject({ code: "REQUIREMENTS" });
    await expect(
      command({ action: "technique.select", techniqueIds: ["kamehameha"] }),
    ).rejects.toMatchObject({ code: "TECHNIQUE_LOCKED" });
    await database.db.update(s.characters).set({ level: 10 }).where(eq(s.characters.userId, owner));
    await expect(
      command({ action: "technique.learn", techniqueId: "kamehameha" }),
    ).rejects.toMatchObject({ code: "REQUIREMENTS" });
  });
  it("aprendizado concorrente cobra Zeni uma vez", async () => {
    await database.db.update(s.characters).set({ level: 2 }).where(eq(s.characters.userId, owner));
    const results = await Promise.allSettled(
      [0, 1, 2].map(() => command({ action: "technique.learn", techniqueId: "rajada-ki" })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const snap = (await readSnapshot(database.db, owner))!;
    expect(snap.character.zeni).toBe(20);
    expect(snap.learnedTechniques.filter((t) => t === "rajada-ki")).toHaveLength(1);
    expect(snap.character.selectedTechniques[0]).toBe("rajada-ki");
  });
  it("uma poção não pode ser consumida duas vezes", async () => {
    const snap = (await readSnapshot(database.db, owner))!;
    await database.db.update(s.characters).set({ hp: 30 }).where(eq(s.characters.userId, owner));
    await database.db
      .insert(s.inventory)
      .values({ characterId: snap.character.id, itemId: "pocao-hp", quantity: 1 })
      .onConflictDoUpdate({
        target: [s.inventory.characterId, s.inventory.itemId],
        set: { quantity: 1 },
      });
    const results = await Promise.allSettled(
      [0, 1].map(() => command({ action: "item.use", itemId: "pocao-hp" })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const next = (await readSnapshot(database.db, owner))!;
    expect(next.character.hp).toBe(93);
    expect(next.inventory).toEqual([{ itemId: "pocao-ki", quantity: 1 }]);
  });
  it("não gasta item sem efeito e não ultrapassa HP/Ki máximos", async () => {
    const snap = (await readSnapshot(database.db, owner))!;
    await database.db
      .insert(s.inventory)
      .values({ characterId: snap.character.id, itemId: "semente-deuses", quantity: 1 });
    await expect(command({ action: "item.use", itemId: "semente-deuses" })).rejects.toMatchObject({
      code: "NO_EFFECT",
    });
    await database.db
      .update(s.characters)
      .set({ hp: 0, ki: 0 })
      .where(eq(s.characters.userId, owner));
    await command({ action: "item.use", itemId: "semente-deuses" });
    const next = (await readSnapshot(database.db, owner))!;
    expect(next.character.hp).toBe(next.stats.maxHp);
    expect(next.character.ki).toBe(next.stats.maxKi);
  });
  it("equipamento exige posse e recalcula atributos sem curar", async () => {
    await expect(
      command({ action: "equipment.equip", itemId: "armadura-simples" }),
    ).rejects.toMatchObject({ code: "NOT_OWNED" });
    const initial = (await readSnapshot(database.db, owner))!;
    await database.db
      .insert(s.inventory)
      .values({ characterId: initial.character.id, itemId: "armadura-simples", quantity: 1 });
    await command({ action: "equipment.equip", itemId: "armadura-simples" });
    const next = (await readSnapshot(database.db, owner))!;
    expect(next.stats.powerLevel).toBeGreaterThan(initial.stats.powerLevel);
    expect(next.character.hp).toBe(initial.character.hp);
    await command({ action: "equipment.unequip", slot: "armor" });
    expect((await readSnapshot(database.db, owner))!.stats).toEqual(initial.stats);
  });
  it("bloqueia área, boss e associação de inimigo adulterada", async () => {
    await expect(command({ action: "explore", areaId: "deserto" })).rejects.toMatchObject({
      code: "AREA_LOCKED",
    });
    await expect(
      command({ action: "battle", areaId: "floresta", enemyId: "piccolo-daimao" }),
    ).rejects.toMatchObject({ code: "INVALID_ENCOUNTER" });
    await expect(command({ action: "boss", enemyId: "piccolo-daimao" })).rejects.toMatchObject({
      code: "REQUIREMENTS",
    });
  });
  it("descanso recupera personagem derrotado após o prazo", async () => {
    await database.db
      .update(s.characters)
      .set({ hp: 0, ki: 0 })
      .where(eq(s.characters.userId, owner));
    await expect(command({ action: "explore", areaId: "floresta" })).rejects.toMatchObject({
      code: "NO_HP",
    });
    await command({ action: "rest.start" });
    const snap = (await readSnapshot(database.db, owner))!;
    await database.db
      .update(s.activities)
      .set({ finishesAt: new Date(0) })
      .where(eq(s.activities.id, snap.activity!.id));
    await command({ action: "activity.finish", activityId: snap.activity!.id });
    const next = (await readSnapshot(database.db, owner))!;
    expect(next.character.hp).toBe(next.stats.maxHp);
    expect(next.character.ki).toBe(next.stats.maxKi);
  });
  it("isolamento impede acessar ou modificar outro personagem", async () => {
    const another = randomUUID();
    await database.db
      .insert(s.user)
      .values({ id: another, name: "Outro", email: `${another}@example.test` });
    expect(await readSnapshot(database.db, another)).toBeNull();
    await expect(
      executeAction(database.db, another, {
        action: "training.start",
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await readSnapshot(database.db, owner))!.activity).toBeNull();
  });
  it("limite de requisições é atômico entre conexões", async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, () => consumeLimit(database.db, "test-rate", 5, 60)),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
    expect(results.filter((r) => !r.allowed).every((r) => r.retryAfter! > 0)).toBe(true);
  });
  it("rollback desfaz batalha, drops e recompensa em falha tardia", async () => {
    await database.db.execute(
      sql`CREATE FUNCTION test_fail_reward() RETURNS trigger AS $$ BEGIN IF NEW.zeni > OLD.zeni THEN RAISE EXCEPTION 'falha de teste'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`,
    );
    await database.db.execute(
      sql`CREATE TRIGGER test_reward_failure BEFORE UPDATE ON characters FOR EACH ROW EXECUTE FUNCTION test_fail_reward()`,
    );
    try {
      await expect(
        command({ action: "battle", areaId: "floresta", enemyId: "lobo" }),
      ).rejects.toThrow();
      const next = (await readSnapshot(database.db, owner))!;
      expect(next.character.xp).toBe(0);
      expect(next.character.zeni).toBe(50);
      expect(next.character.hp).toBe(180);
      expect(next.inventory).toHaveLength(2);
      expect(next.latestBattle).toBeNull();
      expect(next.history).toHaveLength(1);
    } finally {
      await database.db.execute(sql`DROP TRIGGER test_reward_failure ON characters`);
      await database.db.execute(sql`DROP FUNCTION test_fail_reward()`);
    }
  });
});

describe("Builds, campanha e economia transacionais", () => {
  it("a campanha inteira registra objetivos, libera mestres e conclui os seis capítulos", async () => {
    // An advanced, legal build skips leveling time; every victory and quest flag is earned by the service.
    const initial = (await readSnapshot(database.db, owner))!;
    const allocation = { strength: 80, defense: 40, speed: 0, endurance: 60, kiControl: 20 };
    await database.db
      .update(s.characters)
      .set({
        level: 40,
        allocation,
        base: buildAttributes(
          initial.catalog.races.find((r) => r.id === "saiyajin")!,
          allocation,
        ),
      })
      .where(eq(s.characters.userId, owner));
    for (const quest of initial.catalog.quests) {
      // These scenarios compress hours of play; reset only the fixture's request bucket between quests.
      await database.db.delete(s.rateLimit).where(eq(s.rateLimit.key, `game:${owner}`));
      for (const objective of quest.objectives) {
        if (objective.kind === "deliver") {
          await database.db
            .insert(s.inventory)
            .values({
              characterId: initial.character.id,
              itemId: objective.itemId,
              quantity: objective.quantity,
            })
            .onConflictDoUpdate({
              target: [s.inventory.characterId, s.inventory.itemId],
              set: { quantity: sql`${s.inventory.quantity} + ${objective.quantity}` },
            });
        } else if (objective.kind === "train") {
          for (let i = 0; i < objective.quantity; i++) {
            await command({ action: "training.start" });
            const activity = (await readSnapshot(database.db, owner))!.activity!;
            await database.db
              .update(s.activities)
              .set({ finishesAt: new Date(0) })
              .where(eq(s.activities.id, activity.id));
            await command({ action: "activity.finish", activityId: activity.id });
          }
        } else {
          for (let i = 0; i < objective.quantity; i++) {
            await database.db
              .update(s.characters)
              .set({ hp: 660, ki: 249, nextBattleAt: null })
              .where(eq(s.characters.userId, owner));
            const enemy = initial.catalog.enemies.find((e) => e.id === objective.enemyId)!;
            const area = initial.catalog.encounters.find((e) => e.enemyId === enemy.id)!;
            const result = await command(
              enemy.boss
                ? { action: "boss", enemyId: enemy.id }
                : { action: "battle", areaId: area.areaId, enemyId: enemy.id },
            );
            if (result.battle) expect(result.battle.outcome).toBe("victory");
            let battle = (await readSnapshot(database.db, owner))!.activeBattle;
            while (battle) {
              const technique =
                battle.techniques.find((t) => t.id === "chute" && t.available) ??
                battle.techniques.find((t) => t.id === "soco" && t.available);
              const turn = await command({
                action: technique ? "battle.turn" : "battle.action",
                battleId: battle.id,
                round: battle.round,
                ...(technique ? { techniqueId: technique.id } : { command: { kind: "guard" } }),
              });
              if (turn.battle) expect(turn.battle.outcome).toBe("victory");
              battle = (await readSnapshot(database.db, owner))!.activeBattle;
            }
          }
        }
      }
      await command({ action: "quest.claim", questId: quest.id });
      expect((await readSnapshot(database.db, owner))!.character.flags).toContain(
        `quest:${quest.id}`,
      );
    }
    const final = (await readSnapshot(database.db, owner))!;
    expect(final.character.campaignOrder).toBe(6);
    expect(final.character.flags).toEqual(
      expect.arrayContaining([
        "master:kame",
        "master:karin",
        "quest:daimao",
        "defeated:piccolo-daimao",
      ]),
    );
    expect(final.character.questProgress!.filter((q) => q.claimed)).toHaveLength(
      initial.catalog.quests.length,
    );
  }, 60000);
  it("não aceita orçamento extra e distribuições simultâneas gastam pontos uma vez", async () => {
    const points = { ...emptyAllocation(), strength: 5 };
    const results = await Promise.allSettled(
      [0, 1, 2].map(() => command({ action: "attributes.allocate", points })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const next = (await readSnapshot(database.db, owner))!;
    expect(next.character.base.strength).toBe(18);
    expect(next.character.hp).toBe(180);
    expect(next.character.ratedPower).toBe(next.stats.powerLevel);
    await command({ action: "attributes.respec", settlementId: "paozu" });
    expect((await readSnapshot(database.db, owner))!.character).toMatchObject({
      zeni: 50,
      respecCount: 1,
      allocation: emptyAllocation(),
    });
    await command({ action: "attributes.allocate", points });
    await expect(
      command({ action: "attributes.respec", settlementId: "paozu" }),
    ).rejects.toMatchObject({ code: "NOT_ENOUGH_ZENI" });
  });
  it("compras debitam preço do catálogo e crafting falho restaura materiais e Zeni", async () => {
    await command({ action: "shop.buy", offerId: "paozu-pocao-hp", quantity: 2 });
    const before = (await readSnapshot(database.db, owner))!;
    expect(before.character.zeni).toBe(10);
    expect(before.inventory.find((i) => i.itemId === "pocao-hp")!.quantity).toBe(4);
    await expect(
      command({ action: "shop.buy", offerId: "paozu-pocao-hp", quantity: 1 }),
    ).rejects.toMatchObject({ code: "NOT_ENOUGH_ZENI" });
    await database.db
      .insert(s.inventory)
      .values({ characterId: before.character.id, itemId: "presa", quantity: 6 });
    await expect(
      command({ action: "recipe.craft", recipeId: "bastao", quantity: 1 }),
    ).rejects.toMatchObject({ code: "NOT_OWNED" });
    const after = (await readSnapshot(database.db, owner))!;
    expect(after.character.zeni).toBe(10);
    expect(after.inventory.find((i) => i.itemId === "presa")!.quantity).toBe(6);
    await database.db
      .insert(s.inventory)
      .values({ characterId: before.character.id, itemId: "couro", quantity: 2 });
    await command({ action: "recipe.craft", recipeId: "bastao", quantity: 1 });
    const done = (await readSnapshot(database.db, owner))!;
    expect(done.character.zeni).toBe(0);
    expect(done.inventory.find((i) => i.itemId === "bastao")!.quantity).toBe(1);
    await command({ action: "equipment.equip", itemId: "bastao" });
    await expect(
      command({ action: "shop.sell", settlementId: "paozu", itemId: "bastao", quantity: 1 }),
    ).rejects.toMatchObject({ code: "ITEM_EQUIPPED" });
  });
  it("missões registram vitórias reais, são encadeadas e concedem recompensa única", async () => {
    await expect(command({ action: "quest.claim", questId: "floresta" })).rejects.toMatchObject({
      code: "QUEST_INCOMPLETE",
    });
    await expect(command({ action: "quest.claim", questId: "yamcha" })).rejects.toMatchObject({
      code: "REQUIREMENTS",
    });
    for (let i = 0; i < 2; i++) {
      await database.db
        .update(s.characters)
        .set({ hp: 180, nextBattleAt: null })
        .where(eq(s.characters.userId, owner));
      await command({ action: "battle", areaId: "floresta", enemyId: "lobo" });
    }
    const input = actionInput.parse({
      action: "quest.claim",
      questId: "floresta",
      idempotencyKey: randomUUID(),
    });
    await Promise.all([0, 1, 2].map(() => executeAction(database.db, owner, input)));
    const next = (await readSnapshot(database.db, owner))!;
    expect(next.character).toMatchObject({ level: 2, xp: 26, zeni: 116 });
    expect(next.character.flags).toContain("quest:floresta");
    expect(next.character.questProgress!.find((q) => q.questId === "floresta")!.claimed).toBe(true);
    await expect(command({ action: "quest.claim", questId: "floresta" })).rejects.toMatchObject({
      code: "ALREADY_CLAIMED",
    });
  });
  it("boss é manual mesmo com preferência automática e não pode ser assumido pelo automático", async () => {
    await database.db
      .update(s.characters)
      .set({ level: 3, flags: ["quest:floresta"] })
      .where(eq(s.characters.userId, owner));
    await command({ action: "boss", enemyId: "yamcha" });
    const before = (await readSnapshot(database.db, owner))!;
    expect(before.activeBattle).toMatchObject({ manualOnly: true, version: 2, round: 1 });
    await command({ action: "combat.mode", mode: "automatic" });
    expect((await readSnapshot(database.db, owner))!.activeBattle).toEqual(before.activeBattle);
    await expect(
      command({ action: "attributes.allocate", points: { ...emptyAllocation(), strength: 1 } }),
    ).rejects.toMatchObject({ code: "BATTLE_PENDING" });
  });
  it("poção da bolsa é descontada exatamente uma vez e recarga persiste após reload", async () => {
    await database.db.update(s.characters).set({ hp: 60 }).where(eq(s.characters.userId, owner));
    await command({ action: "combat.mode", mode: "manual" });
    await command({ action: "battle", areaId: "floresta", enemyId: "bandido" });
    const before = (await readSnapshot(database.db, owner))!;
    const input = actionInput.parse({
      action: "battle.action",
      battleId: before.activeBattle!.id,
      round: 1,
      command: { kind: "item", itemId: "pocao-hp" },
      idempotencyKey: randomUUID(),
    });
    const results = await Promise.all(
      [0, 1, 2].map(() => executeAction(database.db, owner, input, { random: () => 0.1 })),
    );
    expect(results[0]).toEqual(results[2]);
    const next = (await readSnapshot(database.db, owner))!;
    expect(next.inventory.find((i) => i.itemId === "pocao-hp")!.quantity).toBe(1);
    expect(next.activeBattle).toMatchObject({ round: 2, itemUses: 1, itemCooldown: 2 });
    await expect(
      command({
        action: "battle.action",
        battleId: next.activeBattle!.id,
        round: 2,
        command: { kind: "item", itemId: "pocao-hp" },
      }),
    ).rejects.toMatchObject({ code: "ITEM_UNAVAILABLE" });
    expect((await readSnapshot(database.db, owner))!.activeBattle).toEqual(next.activeBattle);
  });
  it("derrota perde apenas o Zeni previsto e ranking não revela email", async () => {
    await database.db
      .update(s.characters)
      .set({ hp: 1, zeni: 3000 })
      .where(eq(s.characters.userId, owner));
    await command({ action: "combat.mode", mode: "manual" });
    await command({ action: "battle", areaId: "floresta", enemyId: "lobo" });
    const before = (await readSnapshot(database.db, owner))!;
    await command({
      action: "battle.action",
      battleId: before.activeBattle!.id,
      round: 1,
      command: { kind: "guard" },
    });
    const next = (await readSnapshot(database.db, owner))!;
    expect(next.character).toMatchObject({ level: 1, xp: 0, zeni: 2900 });
    expect(next.latestBattle).toMatchObject({ outcome: "defeat", zeniLost: 100 });
    const ranking = await readRanking(database.db, owner, null);
    expect(ranking.own!.powerLevel).toBe(next.stats.powerLevel);
    expect(JSON.stringify(ranking)).not.toContain("@");
    expect(Object.keys(ranking.entries[0])).not.toContain("userId");
  });
  it("batalha v1 usa suas definições salvas e só migra depois de concluir", async () => {
    const before = (await readSnapshot(database.db, owner))!,
      race = legacyCatalog.races[0];
    const old = createCombat({
      id: randomUUID(),
      player: {
        name: "Rafael",
        hp: 400,
        ki: 150,
        stats: deriveStats({ ...race.base, strength: 60 }, 6),
        techniques: legacyCatalog.techniques.filter((t) => t.id === "chute"),
      },
      enemy: legacyCatalog.enemies[1],
      techniques: legacyCatalog.techniques,
      drops: legacyCatalog.drops,
      random: () => 0.5,
    });
    await database.db
      .update(s.characters)
      .set({
        rulesVersion: 1,
        level: 6,
        xp: 42,
        base: race.base,
        hp: 180,
        ki: 90,
        flags: ["old:achievement"],
        combatMode: "manual",
      })
      .where(eq(s.characters.userId, owner));
    await database.db
      .insert(s.activeBattles)
      .values({ id: old.id, characterId: before.character.id, state: old });
    expect((await readSnapshot(database.db, owner))!.activeBattle!.version).not.toBe(2);
    await command({ action: "combat.mode", mode: "automatic" });
    const after = (await readSnapshot(database.db, owner))!;
    expect(after.latestBattle!.xp).toBe(40);
    expect(after.character).toMatchObject({ level: 6, xp: 82, rulesVersion: 2, respecCount: 0 });
    expect(after.character.flags).toContain("old:achievement");
    expect(spentPoints(after.character.allocation!)).toBe(30);
  });
});

describe("Combate manual persistente", () => {
  it("valida Ki no servidor e mantém a batalha intacta ao rejeitar o golpe", async () => {
    await database.db
      .update(s.characters)
      .set({ level: 2, ki: 10 })
      .where(eq(s.characters.userId, owner));
    await command({ action: "technique.learn", techniqueId: "rajada-ki" });
    await command({ action: "combat.mode", mode: "manual" });
    await command({ action: "battle", areaId: "floresta", enemyId: "bandido" });
    const before = (await readSnapshot(database.db, owner))!;
    await expect(
      command({
        action: "battle.turn",
        battleId: before.activeBattle!.id,
        round: 1,
        techniqueId: "rajada-ki",
      }),
    ).rejects.toMatchObject({ code: "NO_KI" });
    const after = (await readSnapshot(database.db, owner))!;
    expect(after.character).toEqual(before.character);
    expect(after.activeBattle).toEqual(before.activeBattle);
  });
  it("falha tardia restaura modo, estado ativo, drops e recompensa", async () => {
    await command({ action: "combat.mode", mode: "manual" });
    await command({ action: "battle", areaId: "floresta", enemyId: "bandido" });
    const before = (await readSnapshot(database.db, owner))!;
    await database.db.execute(
      sql`CREATE FUNCTION test_manual_failure() RETURNS trigger AS $$ BEGIN IF NEW.zeni > OLD.zeni THEN RAISE EXCEPTION 'falha de teste'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`,
    );
    await database.db.execute(
      sql`CREATE TRIGGER test_manual_reward_failure BEFORE UPDATE ON characters FOR EACH ROW EXECUTE FUNCTION test_manual_failure()`,
    );
    try {
      await expect(command({ action: "combat.mode", mode: "automatic" })).rejects.toThrow();
      const after = (await readSnapshot(database.db, owner))!;
      expect(after.character).toEqual(before.character);
      expect(after.activeBattle).toEqual(before.activeBattle);
      expect(after.latestBattle).toBeNull();
      expect(after.inventory).toEqual(before.inventory);
    } finally {
      await database.db.execute(sql`DROP TRIGGER test_manual_reward_failure ON characters`);
      await database.db.execute(sql`DROP FUNCTION test_manual_failure()`);
    }
    await command({ action: "combat.mode", mode: "automatic" });
    expect((await readSnapshot(database.db, owner))!.character).toMatchObject({ xp: 36, zeni: 66 });
  });
  async function start() {
    await command({ action: "combat.mode", mode: "manual" });
    await command({ action: "battle", areaId: "floresta", enemyId: "bandido" });
    return (await readSnapshot(database.db, owner))!;
  }
  it("mantém automático para personagens existentes e salva a preferência", async () => {
    expect((await readSnapshot(database.db, owner))!.character.combatMode).toBe("automatic");
    await command({ action: "combat.mode", mode: "manual" });
    expect((await readSnapshot(database.db, owner))!.character.combatMode).toBe("manual");
    await command({ action: "training.start" });
    await command({ action: "combat.mode", mode: "automatic" });
    expect((await readSnapshot(database.db, owner))!.character.combatMode).toBe("automatic");
    expect((await readSnapshot(database.db, owner))!.activity).not.toBeNull();
  });
  it("salva a batalha sem conceder recompensas antecipadas", async () => {
    const snap = await start();
    expect(snap.activeBattle).toMatchObject({ round: 1, enemyHp: 91 });
    expect(snap.character).toMatchObject({ hp: 180, xp: 0, zeni: 50 });
    expect(snap.latestBattle).toBeNull();
    expect(snap.inventory).toEqual(
      expect.arrayContaining([
        { itemId: "pocao-hp", quantity: 2 },
        { itemId: "pocao-ki", quantity: 1 },
      ]),
    );
    expect(await database.db.select().from(s.activeBattles)).toHaveLength(1);
  });
  it("replay da mesma rodada não aplica danos duas vezes", async () => {
    const snap = await start();
    const turn = {
      action: "battle.turn",
      battleId: snap.activeBattle!.id,
      round: 1,
      techniqueId: "chute",
      idempotencyKey: randomUUID(),
    };
    const results = await Promise.all(
      [0, 1, 2].map(() => executeAction(database.db, owner, turn, { random: () => 0.1 })),
    );
    expect(results[0]).toEqual(results[2]);
    const after = (await readSnapshot(database.db, owner))!;
    expect(after.activeBattle?.round).toBe(2);
    expect(
      after.activeBattle?.events.filter((e) => e.type === "attack" && e.actor === "player"),
    ).toHaveLength(1);
    expect(after.character.xp).toBe(0);
  });
  it("rodadas concorrentes com chaves diferentes avançam uma vez", async () => {
    const snap = await start();
    const results = await Promise.allSettled(
      [0, 1, 2].map(() =>
        command({
          action: "battle.turn",
          battleId: snap.activeBattle!.id,
          round: 1,
          techniqueId: "soco",
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      results
        .filter((r) => r.status === "rejected")
        .every((r) => r.status === "rejected" && r.reason.code === "STALE_TURN"),
    ).toBe(true);
    expect((await readSnapshot(database.db, owner))!.activeBattle?.round).toBe(2);
  });
  it("valida batalha, técnica e recarga sem avançar o estado", async () => {
    const snap = await start();
    await expect(
      command({ action: "battle.turn", battleId: randomUUID(), round: 1, techniqueId: "soco" }),
    ).rejects.toMatchObject({ code: "BATTLE_NOT_PENDING" });
    await expect(
      command({
        action: "battle.turn",
        battleId: snap.activeBattle!.id,
        round: 1,
        techniqueId: "kamehameha",
      }),
    ).rejects.toMatchObject({ code: "TECHNIQUE_LOCKED" });
    await command({
      action: "battle.turn",
      battleId: snap.activeBattle!.id,
      round: 1,
      techniqueId: "chute",
    });
    const before = (await readSnapshot(database.db, owner))!;
    await expect(
      command({
        action: "battle.turn",
        battleId: snap.activeBattle!.id,
        round: 2,
        techniqueId: "chute",
      }),
    ).rejects.toMatchObject({ code: "TECHNIQUE_COOLDOWN" });
    expect((await readSnapshot(database.db, owner))!.activeBattle).toEqual(before.activeBattle);
    expect((await readSnapshot(database.db, owner))!.character.hp).toBe(before.character.hp);
  });
  it("impede outra luta, treinamento, item e equipamento durante o combate", async () => {
    await start();
    for (const action of [
      { action: "battle", areaId: "floresta", enemyId: "lobo" },
      { action: "training.start" },
      { action: "rest.start" },
      { action: "item.use", itemId: "pocao-hp" },
      { action: "equipment.equip", itemId: "bastao" },
      { action: "technique.select", techniqueIds: ["soco"] },
    ])
      await expect(command(action)).rejects.toMatchObject({ code: "BATTLE_PENDING" });
    expect(await database.db.select().from(s.activeBattles)).toHaveLength(1);
  });
  it("assumir automático preserva golpes anteriores e premia uma vez", async () => {
    const snap = await start();
    await command({
      action: "battle.turn",
      battleId: snap.activeBattle!.id,
      round: 1,
      techniqueId: "soco",
    });
    const before = (await readSnapshot(database.db, owner))!;
    const mode = { action: "combat.mode", mode: "automatic", idempotencyKey: randomUUID() };
    const results = await Promise.all(
      [0, 1, 2].map(() => executeAction(database.db, owner, mode, { random: () => 0.1 })),
    );
    expect(results[0].battle?.events.slice(0, before.activeBattle!.events.length)).toEqual(
      before.activeBattle!.events,
    );
    expect(results[0].battle?.id).toBe(snap.activeBattle!.id);
    const after = (await readSnapshot(database.db, owner))!;
    expect(after.activeBattle).toBeNull();
    expect(after.character).toMatchObject({ combatMode: "automatic", xp: 36, zeni: 66 });
    expect(after.character.nextBattleAt).not.toBeNull();
    expect(await database.db.select().from(s.battles)).toHaveLength(1);
    await expect(
      command({
        action: "battle.turn",
        battleId: snap.activeBattle!.id,
        round: 2,
        techniqueId: "soco",
      }),
    ).rejects.toMatchObject({ code: "BATTLE_NOT_PENDING" });
    await command({ action: "combat.mode", mode: "automatic" });
    expect((await readSnapshot(database.db, owner))!.character.zeni).toBe(66);
  });
  it("conclusão manual concorrente concede uma única recompensa", async () => {
    const snap = await start();
    for (const [round, techniqueId] of [
      [1, "chute"],
      [2, "soco"],
    ] as const)
      await command({ action: "battle.turn", battleId: snap.activeBattle!.id, round, techniqueId });
    const end = {
      action: "battle.turn",
      battleId: snap.activeBattle!.id,
      round: 3,
      techniqueId: "chute",
      idempotencyKey: randomUUID(),
    };
    const results = await Promise.all(
      [0, 1, 2].map(() => executeAction(database.db, owner, end, { random: () => 0.1 })),
    );
    expect(results[0].battle?.outcome).toBe("victory");
    const after = (await readSnapshot(database.db, owner))!;
    expect(after.character).toMatchObject({ xp: 36, zeni: 66 });
    expect(after.activeBattle).toBeNull();
    expect(after.inventory.find((i) => i.itemId === "tecido")?.quantity).toBe(1);
    expect(await database.db.select().from(s.battles)).toHaveLength(1);
  });
  it("não permite controlar uma batalha pertencente a outro usuário", async () => {
    const snap = await start();
    const other = randomUUID();
    await database.db
      .insert(s.user)
      .values({ id: other, name: "Outro", email: `${other}@example.test` });
    await createCharacter(database.db, other, {
      name: "Outro",
      raceId: "humano",
      idempotencyKey: randomUUID(),
    });
    await expect(
      executeAction(database.db, other, {
        action: "battle.turn",
        battleId: snap.activeBattle!.id,
        round: 1,
        techniqueId: "soco",
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "BATTLE_NOT_PENDING" });
    expect((await readSnapshot(database.db, owner))!.activeBattle?.round).toBe(1);
    expect((await readSnapshot(database.db, other))!.activeBattle).toBeNull();
  });
});
