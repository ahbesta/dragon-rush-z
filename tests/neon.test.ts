import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { createDatabase, type Database } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { createCharacter, executeAction, readSnapshot } from "@/server/game-service";
vi.mock("server-only", () => ({}));
let database: Database;
let owner: string;
const fixtureOwners: string[] = [];
describe.skipIf(!process.env.TEST_DATABASE_URL)("Concorrência em PostgreSQL Neon real", () => {
  it("início concorrente mantém um único encontro e sorteio", async () => {
    const input = { action: "exploration.start", areaId: "floresta", idempotencyKey: randomUUID() };
    const results = await Promise.all(
      [0, 1, 2, 3].map(() => executeAction(database.db, owner, input, { random: () => 0.1 })),
    );
    expect(results[0]).toEqual(results[1]);
    const snap = (await readSnapshot(database.db, owner))!;
    expect(snap.activeExploration?.category).toBe("gather");
    expect(snap.catalog.explorationEvents).toBeUndefined();
    expect(
      await database.db
        .select()
        .from(s.explorationSessions)
        .where(eq(s.explorationSessions.characterId, snap.character.id)),
    ).toHaveLength(1);
  });
  it("escolhas concorrentes com chaves diferentes avançam apenas uma etapa", async () => {
    await executeAction(
      database.db,
      owner,
      { action: "exploration.start", areaId: "floresta", idempotencyKey: randomUUID() },
      { random: () => 0.1 },
    );
    const id = (await readSnapshot(database.db, owner))!.activeExploration!.id;
    const results = await Promise.allSettled(
      [0, 1, 2].map(() =>
        executeAction(database.db, owner, {
          action: "exploration.choose",
          encounterId: id,
          revision: 0,
          choiceId: "collect",
          idempotencyKey: randomUUID(),
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const snap = (await readSnapshot(database.db, owner))!;
    expect(snap.activeExploration?.revision).toBe(1);
    expect(snap.activeExploration?.pending.items).toEqual([{ itemId: "erva", quantity: 1 }]);
    expect(snap.inventory.some((i) => i.itemId === "erva")).toBe(false);
  });
  it("saída concorrente concede o material uma vez e respeita cooldown", async () => {
    await executeAction(
      database.db,
      owner,
      { action: "exploration.start", areaId: "floresta", idempotencyKey: randomUUID() },
      { random: () => 0.1 },
    );
    const id = (await readSnapshot(database.db, owner))!.activeExploration!.id;
    await executeAction(database.db, owner, {
      action: "exploration.choose",
      encounterId: id,
      revision: 0,
      choiceId: "collect",
      idempotencyKey: randomUUID(),
    });
    const input = {
      action: "exploration.choose",
      encounterId: id,
      revision: 1,
      choiceId: "retreat",
      idempotencyKey: randomUUID(),
    };
    const results = await Promise.all(
      [0, 1, 2, 3].map(() => executeAction(database.db, owner, input)),
    );
    expect(results[0]).toEqual(results[3]);
    const snap = (await readSnapshot(database.db, owner))!;
    expect(snap.activeExploration).toBeNull();
    expect(snap.inventory.find((i) => i.itemId === "erva")?.quantity).toBe(1);
    expect(snap.character.xp).toBe(0);
    await expect(
      executeAction(database.db, owner, {
        action: "exploration.start",
        areaId: "floresta",
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "COOLDOWN" });
  });
  it("combate manual concorrente resolve uma rodada sob conexões reais", async () => {
    const run = (action: object) =>
      executeAction(
        database.db,
        owner,
        { ...action, idempotencyKey: randomUUID() },
        { random: () => 0.1 },
      );
    await run({ action: "combat.mode", mode: "manual" });
    await run({ action: "battle", areaId: "floresta", enemyId: "bandido" });
    const before = (await readSnapshot(database.db, owner))!;
    const turn = {
      action: "battle.turn",
      battleId: before.activeBattle!.id,
      round: 1,
      techniqueId: "chute",
    };
    const results = await Promise.allSettled([0, 1, 2, 3].map(() => run(turn)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await readSnapshot(database.db, owner))!.activeBattle?.round).toBe(2);
    expect((await readSnapshot(database.db, owner))!.character.xp).toBe(0);
  });
  it("conclusão manual e automático simultâneos concedem uma recompensa", async () => {
    const run = (action: object) =>
      executeAction(
        database.db,
        owner,
        { ...action, idempotencyKey: randomUUID() },
        { random: () => 0.1 },
      );
    await run({ action: "combat.mode", mode: "manual" });
    await run({ action: "battle", areaId: "floresta", enemyId: "bandido" });
    const before = (await readSnapshot(database.db, owner))!;
    for (const [round, techniqueId] of [
      [1, "chute"],
      [2, "soco"],
    ] as const)
      await run({ action: "battle.turn", battleId: before.activeBattle!.id, round, techniqueId });
    await Promise.allSettled([
      run({ action: "combat.mode", mode: "automatic" }),
      run({
        action: "battle.turn",
        battleId: before.activeBattle!.id,
        round: 3,
        techniqueId: "chute",
      }),
    ]);
    const after = (await readSnapshot(database.db, owner))!;
    expect(after.character).toMatchObject({ xp: 36, zeni: 66 });
    expect(after.activeBattle).toBeNull();
    expect(after.inventory.find((i) => i.itemId === "tecido")?.quantity).toBe(1);
    expect(
      await database.db
        .select()
        .from(s.battles)
        .where(eq(s.battles.characterId, after.character.id)),
    ).toHaveLength(1);
  });
  beforeAll(() => {
    database = createDatabase(process.env.TEST_DATABASE_URL!);
  });
  beforeEach(async () => {
    owner = randomUUID();
    fixtureOwners.push(owner);
    await database.db
      .insert(s.user)
      .values({ id: owner, name: "Teste Neon", email: `neon-${owner}@example.test` });
    await createCharacter(database.db, owner, {
      name: "Teste Neon",
      raceId: "saiyajin",
      idempotencyKey: randomUUID(),
    });
  });
  afterAll(async () => {
    if (!database) return;
    try {
      if (fixtureOwners.length) {
        await database.db.delete(s.user).where(inArray(s.user.id, fixtureOwners));
        await database.db.delete(s.rateLimit).where(
          inArray(
            s.rateLimit.key,
            fixtureOwners.map((id) => `game:${id}`),
          ),
        );
      }
    } finally {
      await database.pool.end();
    }
  });
  it("requisições com a mesma chave recebem a mesma batalha e uma recompensa", async () => {
    const input = {
      action: "battle",
      areaId: "floresta",
      enemyId: "lobo",
      idempotencyKey: randomUUID(),
    };
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        executeAction(database.db, owner, input, { random: () => 0.1 }),
      ),
    );
    expect(new Set(results.map((r) => r.battle!.id)).size).toBe(1);
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
  });
  it("chaves diferentes não burlam cooldown sob conexões concorrentes", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 3 }, () =>
        executeAction(
          database.db,
          owner,
          { action: "battle", areaId: "floresta", enemyId: "lobo", idempotencyKey: randomUUID() },
          { random: () => 0.1 },
        ),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      results
        .filter((r) => r.status === "rejected")
        .every((r) => r.status === "rejected" && r.reason.code === "COOLDOWN"),
    ).toBe(true);
  });
  it("treinamento concluído em paralelo só concede XP uma vez", async () => {
    await executeAction(database.db, owner, {
      action: "training.start",
      idempotencyKey: randomUUID(),
    });
    const snap = (await readSnapshot(database.db, owner))!;
    await database.db
      .update(s.activities)
      .set({ startedAt: new Date(0), finishesAt: new Date(300000) })
      .where(
        and(
          eq(s.activities.id, snap.activity!.id),
          eq(s.activities.characterId, snap.character.id),
        ),
      );
    const input = {
      action: "activity.finish",
      activityId: snap.activity!.id,
      idempotencyKey: randomUUID(),
    };
    await Promise.all(Array.from({ length: 4 }, () => executeAction(database.db, owner, input)));
    expect((await readSnapshot(database.db, owner))!.character.xp).toBe(1);
  });
});
