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
    { random: () => 0 },
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
    expect(await database.db.select().from(s.enemies)).toHaveLength(6);
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
    expect((await readSnapshot(database.db, owner))!.character.xp).toBe(50);
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
      [0, 1, 2].map(() => executeAction(database.db, owner, input, { random: () => 0 })),
    );
    expect(results[0].battle!.id).toBe(results[2].battle!.id);
    const snap = (await readSnapshot(database.db, owner))!;
    expect(snap.character.xp).toBe(25);
    expect(snap.character.zeni).toBe(60);
    expect(snap.inventory).toEqual([{ itemId: "pocao-hp", quantity: 1 }]);
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
      .values({ characterId: snap.character.id, itemId: "pocao-hp", quantity: 1 });
    const results = await Promise.allSettled(
      [0, 1].map(() => command({ action: "item.use", itemId: "pocao-hp" })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const next = (await readSnapshot(database.db, owner))!;
    expect(next.character.hp).toBe(120);
    expect(next.inventory).toHaveLength(0);
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
      expect(next.inventory).toHaveLength(0);
      expect(next.latestBattle).toBeNull();
      expect(next.history).toHaveLength(1);
    } finally {
      await database.db.execute(sql`DROP TRIGGER test_reward_failure ON characters`);
      await database.db.execute(sql`DROP FUNCTION test_fail_reward()`);
    }
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
      expect(after.inventory).toEqual([]);
    } finally {
      await database.db.execute(sql`DROP TRIGGER test_manual_reward_failure ON characters`);
      await database.db.execute(sql`DROP FUNCTION test_manual_failure()`);
    }
    await command({ action: "combat.mode", mode: "automatic" });
    expect((await readSnapshot(database.db, owner))!.character).toMatchObject({ xp: 40, zeni: 70 });
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
    expect(snap.activeBattle).toMatchObject({ round: 1, enemyHp: 90 });
    expect(snap.character).toMatchObject({ hp: 180, xp: 0, zeni: 50 });
    expect(snap.latestBattle).toBeNull();
    expect(snap.inventory).toEqual([]);
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
      [0, 1, 2].map(() => executeAction(database.db, owner, turn, { random: () => 0 })),
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
      [0, 1, 2].map(() => executeAction(database.db, owner, mode, { random: () => 0 })),
    );
    expect(results[0].battle?.events.slice(0, before.activeBattle!.events.length)).toEqual(
      before.activeBattle!.events,
    );
    expect(results[0].battle?.id).toBe(snap.activeBattle!.id);
    const after = (await readSnapshot(database.db, owner))!;
    expect(after.activeBattle).toBeNull();
    expect(after.character).toMatchObject({ combatMode: "automatic", xp: 40, zeni: 70 });
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
    expect((await readSnapshot(database.db, owner))!.character.zeni).toBe(70);
  });
  it("conclusão manual concorrente concede uma única recompensa", async () => {
    const snap = await start();
    for (const [round, techniqueId] of [
      [1, "chute"],
      [2, "soco"],
      [3, "chute"],
    ] as const)
      await command({ action: "battle.turn", battleId: snap.activeBattle!.id, round, techniqueId });
    const end = {
      action: "battle.turn",
      battleId: snap.activeBattle!.id,
      round: 4,
      techniqueId: "soco",
      idempotencyKey: randomUUID(),
    };
    const results = await Promise.all(
      [0, 1, 2].map(() => executeAction(database.db, owner, end, { random: () => 0 })),
    );
    expect(results[0].battle?.outcome).toBe("victory");
    const after = (await readSnapshot(database.db, owner))!;
    expect(after.character).toMatchObject({ xp: 40, zeni: 70 });
    expect(after.activeBattle).toBeNull();
    expect(after.inventory.find((i) => i.itemId === "bastao")?.quantity).toBe(1);
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
