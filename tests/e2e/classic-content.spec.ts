import { test, expect } from "./browser-test";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createDatabase } from "../../src/server/db/client";
import * as s from "../../src/server/db/schema";
import { seedCatalog } from "../../src/server/db/seed-data";
import { buildAttributes, recommendedAllocation } from "../../src/game/builds";
import { deriveBuildStats } from "../../src/game/attributes";

test("campanha avançada, vilas, fabricação, comparação, ranking e arena clássica responsivos", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(120000);
  const database = createDatabase(process.env.DATABASE_URL!);
  const email = `classic-${randomUUID()}@example.test`;
  let ownerId: string | undefined;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    const signup = await page.request.post("/api/auth/sign-up/email", {
      headers: { origin: baseURL! },
      data: { email, password: randomUUID() + "T!", name: "Revisão clássica" },
    });
    expect(signup.ok()).toBe(true);
    const created = await page.request.post("/api/game/characters", {
      headers: { origin: baseURL! },
      data: { name: "Guerreiro Clássico", raceId: "namekuseijin", idempotencyKey: randomUUID() },
    });
    expect(created.ok()).toBe(true);
    const [owner] = await database.db.select().from(s.user).where(eq(s.user.email, email));
    ownerId = owner.id;
    const [character] = await database.db
      .select()
      .from(s.characters)
      .where(eq(s.characters.userId, owner.id));
    const race = seedCatalog.races.find((r) => r.id === "namekuseijin")!;
    const allocation = recommendedAllocation(race, 25);
    const base = buildAttributes(race, allocation);
    const stats = deriveBuildStats(base, 25);
    await database.db
      .update(s.characters)
      .set({
        level: 25,
        allocation,
        base,
        hp: stats.maxHp,
        ki: stats.maxKi,
        ratedPower: stats.powerLevel,
        campaignOrder: 6,
        combatMode: "manual",
        zeni: 3000,
        flags: [
          ...seedCatalog.quests.map((q) => `quest:${q.id}`),
          ...seedCatalog.enemies.filter((e) => !e.heroicOf).map((e) => `defeated:${e.id}`),
          "master:kame",
          "master:karin",
        ],
      })
      .where(eq(s.characters.id, character.id));
    await database.db
      .insert(s.inventory)
      .values(
        seedCatalog.items.map((i) => ({ characterId: character.id, itemId: i.id, quantity: 20 })),
      )
      .onConflictDoNothing();
    const go = async (label: string) => {
      const menu = page.getByRole("button", { name: "Abrir menu", exact: true });
      if (await menu.isVisible()) await menu.click();
      await page
        .locator("#game-navigation")
        .getByRole("button", { name: label, exact: true })
        .click();
    };
    await page.goto("/jogo");
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const label of ["Missões", "Vilas e mercado", "Inventário", "Ranking"]) {
        await go(label);
        if (label === "Vilas e mercado") {
          await page.getByRole("button", { name: "Fabricar e trocar", exact: true }).click();
          await expect(
            page.getByRole("button", { name: "Fabricar", exact: true }).first(),
          ).toBeEnabled();
          await page.getByRole("button", { name: "Comprar", exact: true }).click();
        }
        if (label === "Ranking") await expect(page.locator(".rpg-ranking table")).toBeVisible();
        if (label === "Inventário") {
          for (const image of await page.locator(".inventory-grid .item-icon img").all()) {
            await image.scrollIntoViewIfNeeded();
            await expect
              .poll(() =>
                image.evaluate(
                  (el) =>
                    (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0,
                ),
              )
              .toBe(true);
          }
        }
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `${label} overflow ${width}`,
        ).toBe(true);
        await page.screenshot({
          path: `.local/screenshots/classic-${label === "Vilas e mercado" ? "market" : label === "Missões" ? "quests" : label === "Inventário" ? "inventory" : "ranking"}-${width}.png`,
          fullPage: true,
        });
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await go("Batalhar");
    await page.getByRole("button", { name: "Ver desafios", exact: true }).click();
    await expect(page.locator(".rpg-heroic-card")).toHaveCount(19);
    await page
      .locator(".rpg-heroics")
      .screenshot({ path: ".local/screenshots/classic-heroics.png" });
    await page.getByRole("button", { name: "Trocar área", exact: true }).click();
    await page.getByRole("button", { name: /Castelo de Pilaf/ }).click();
    await page
      .locator(".enemy-row")
      .filter({ hasText: "Pilaf" })
      .getByRole("button", { name: "Desafiar · manual", exact: true })
      .click();
    const arena = page.locator(".battle-arena");
    const pilaf = arena.locator(".enemy .arena-sprite-sheet");
    await expect(pilaf).toHaveAttribute("src", "/images/classic/pilaf-v2.webp");
    await expect
      .poll(() =>
        pilaf.evaluate(
          (el) =>
            (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth === 384,
        ),
      )
      .toBe(true);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await arena.screenshot({ path: `.local/screenshots/pilaf-repaired-${width}.png` });
    }
    for (let turn = 0; turn < 20; turn++) {
      const current = (await (await page.request.get("/api/game")).json()).snapshot;
      if (!current.activeBattle) break;
      const response = await page.request.post("/api/game/actions", {
        headers: { origin: baseURL! },
        data: {
          action: "battle.turn",
          battleId: current.activeBattle.id,
          round: current.activeBattle.round,
          techniqueId: "soco",
          idempotencyKey: randomUUID(),
        },
      });
      expect(response.ok(), await response.text()).toBe(true);
    }
    const finished = (await (await page.request.get("/api/game")).json()).snapshot;
    expect(finished.activeBattle).toBeNull();
    await database.db
      .update(s.characters)
      .set({ hp: stats.maxHp, ki: stats.maxKi, nextBattleAt: null })
      .where(eq(s.characters.id, character.id));
    const boss = await page.request.post("/api/game/actions", {
      headers: { origin: baseURL! },
      data: { action: "boss", enemyId: "robo-pirata", idempotencyKey: randomUUID() },
    });
    expect(boss.ok(), await boss.text()).toBe(true);
    await page.reload();
    await go("Batalhar");
    await expect(page.locator(".battle-arena")).toBeVisible();
    await expect(
      page.locator('.battle-arena .arena-fighter.enemy img[src*="robo-pirata"]'),
    ).toHaveCount(1);
    await expect(
      page.locator('.battle-arena .arena-combat-timeline img[src*="robo-pirata"]'),
    ).toHaveCount(1);
    await page
      .locator(".battle-arena")
      .screenshot({ path: ".local/screenshots/classic-robot-arena.png" });
    expect(errors).toEqual([]);
  } finally {
    if (ownerId) {
      await database.db.delete(s.user).where(eq(s.user.id, ownerId));
      await database.db.delete(s.rateLimit).where(eq(s.rateLimit.key, `game:${ownerId}`));
    }
    await database.pool.end();
  }
});
