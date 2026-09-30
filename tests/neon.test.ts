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
        executeAction(database.db, owner, input, { random: () => 0 }),
      ),
    );
    expect(new Set(results.map((r) => r.battle!.id)).size).toBe(1);
    const snap = (await readSnapshot(database.db, owner))!;
    expect(snap.character.xp).toBe(25);
    expect(snap.character.zeni).toBe(60);
    expect(snap.inventory).toEqual([{ itemId: "pocao-hp", quantity: 1 }]);
  });
  it("chaves diferentes não burlam cooldown sob conexões concorrentes", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 3 }, () =>
        executeAction(
          database.db,
          owner,
          { action: "battle", areaId: "floresta", enemyId: "lobo", idempotencyKey: randomUUID() },
          { random: () => 0 },
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
      .set({ finishesAt: new Date(0) })
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
    expect((await readSnapshot(database.db, owner))!.character.xp).toBe(50);
  });
});
