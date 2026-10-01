import { test, expect } from "./browser-test";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createDatabase } from "../../src/server/db/client";
import * as s from "../../src/server/db/schema";
import { applyExperience } from "./progress-fixture";
import { deriveBuildStats } from "../../src/game/attributes";
import type { GameSnapshot } from "../../src/game/types";

for (const width of [390, 1440])
  test(`fluxo de áreas, chegada à arena e drops por raridade em ${width}px`, async ({
    page,
    baseURL,
  }) => {
    const database = createDatabase(process.env.DATABASE_URL!);
    const email = `battle-flow-${randomUUID()}@example.test`;
    let ownerId: string | undefined;
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await page.setViewportSize({ width, height: 900 });
      const origin = { origin: baseURL! };
      expect(
        (
          await page.request.post("/api/auth/sign-up/email", {
            headers: origin,
            data: { email, password: randomUUID() + "T!", name: "Fluxo de batalha" },
          })
        ).ok(),
      ).toBe(true);
      expect(
        (
          await page.request.post("/api/game/characters", {
            headers: origin,
            data: { name: "Guerreiro Fluxo", raceId: "saiyajin", idempotencyKey: randomUUID() },
          })
        ).ok(),
      ).toBe(true);
      const [owner] = await database.db.select().from(s.user).where(eq(s.user.email, email));
      ownerId = owner.id;
      const state = async (): Promise<GameSnapshot> =>
        (await (await page.request.get("/api/game")).json()).snapshot;
      const initial = await state();
      const progress = applyExperience(1, 0, 10000, initial.race.base, initial.race);
      const stats = deriveBuildStats(progress.base, progress.level);
      await database.db
        .update(s.characters)
        .set({ ...progress, hp: stats.maxHp, ki: stats.maxKi })
        .where(eq(s.characters.id, initial.character.id));
      await page.goto("/jogo");
      if (await page.getByRole("button", { name: "Abrir menu", exact: true }).isVisible())
        await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
      await page.getByRole("button", { name: "Batalhar", exact: true }).click();
      await expect(page.locator(".area-card").first()).not.toBeVisible();
      await expect(page.locator(".battle-area-current h2")).toHaveText("Floresta do Monte Paozu");
      await page.getByRole("button", { name: "Trocar área", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Escolha sua área" });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator(".area-card.locked")).toHaveCount(0);
      await dialog.getByRole("button", { name: /Todas as áreas/ }).click();
      await expect(dialog.locator(".area-card")).toHaveCount(16);
      expect(
        await dialog.locator(".area-card").evaluateAll((cards) =>
          cards.every((card) => {
            const bounds = card.getBoundingClientRect();
            const title = card.querySelector("h3")!.getBoundingClientRect();
            const details = card.querySelector("div:last-child > span")!.getBoundingClientRect();
            return title.bottom <= bounds.bottom && details.bottom <= bounds.bottom;
          }),
        ),
      ).toBe(true);
      await dialog.screenshot({ path: `.local/screenshots/battle-area-picker-${width}.png` });
      await dialog.getByLabel("Buscar área").fill("Karin");
      await expect(dialog.locator(".area-card")).toHaveCount(2);
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(page.getByRole("button", { name: "Trocar área", exact: true })).toBeFocused();
      await page.getByRole("button", { name: "Trocar área", exact: true }).click();
      await dialog.getByLabel("Buscar área").fill("");
      await dialog.getByRole("button", { name: /Castelo do Rei/ }).click();
      await expect(page.locator(".battle-area-locked")).toBeVisible();
      await expect(
        page
          .locator(".enemy-row")
          .filter({ hasText: "Piccolo Daimao" })
          .getByRole("button", { name: "Desafiar · manual" }),
      ).toBeDisabled();
      await page.getByRole("button", { name: "Trocar área", exact: true }).click();
      await dialog.getByRole("button", { name: /Floresta do Monte Paozu/ }).click();
      // Fixed visual fixtures cover every rarity; the real server still grants its own rolled inventory.
      const expectedItems = (["common", "uncommon", "rare", "epic"] as const).map((rarity) =>
        initial.catalog.items.find((item) => item.rarity === rarity)!,
      );
      let presented: GameSnapshot | undefined;
      await page.route("**/api/game/actions", async (route) => {
        const response = await route.fetch();
        const data = await response.json();
        if (route.request().postDataJSON().action === "battle" && data.snapshot?.latestBattle) {
          data.snapshot.latestBattle.drops = expectedItems.map((item) => ({
            itemId: item.id,
            quantity: 2,
          }));
          presented = data.snapshot;
        }
        await route.fulfill({ response, json: data });
      });
      await page.route("**/api/game", async (route) => {
        if (presented) await route.fulfill({ json: { snapshot: presented } });
        else await route.continue();
      });
      await page
        .locator(".enemy-row")
        .filter({ hasText: "Lobo" })
        .getByRole("button", { name: "Batalhar", exact: true })
        .click();
      const arena = page.locator(".battle-arena");
      await expect(arena).toHaveClass(/arena-completed/);
      await expect
        .poll(() =>
          page
            .locator(".battle-arena-anchor")
            .evaluate((el) => Math.round(el.getBoundingClientRect().top)),
        )
        .toBe(20);
      if (await arena.getByRole("button", { name: "Pular animação", exact: true }).isVisible())
        await arena.getByRole("button", { name: "Pular animação", exact: true }).click();
      const before = await state();
      for (const item of expectedItems) {
        const reveal = arena.locator(".arena-loot-reveal");
        await expect(reveal).toHaveAttribute("data-rarity", item.rarity);
        await expect(reveal).toHaveAttribute("data-item-id", item.id);
        await expect(reveal.getByRole("heading", { name: item.name, exact: true })).toBeVisible();
        const bounds = await reveal.locator(".arena-loot-card").boundingBox(),
          stage = await arena.locator(".battle-stage").boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(stage!.x);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(stage!.x + stage!.width + 1);
        expect(bounds!.y).toBeGreaterThanOrEqual(stage!.y);
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(stage!.y + stage!.height + 1);
        await arena.screenshot({
          path: `.local/screenshots/battle-loot-${item.rarity}-${width}.png`,
        });
        await reveal
          .getByRole("button", {
            name: item === expectedItems.at(-1) ? "Continuar" : "Próximo item",
            exact: true,
          })
          .click();
      }
      await expect(arena.locator(".arena-loot-reveal")).toHaveCount(0);
      await expect(arena.locator(".battle-result .combat-log")).toBeVisible();
      expect(await page.locator(".battle-result").count()).toBe(1);
      await arena.getByRole("button", { name: "Ver drops", exact: true }).click();
      await expect(arena.locator(".arena-loot-reveal")).toHaveAttribute("data-rarity", "common");
      await page.keyboard.press("Escape");
      await expect(arena.locator(".arena-loot-reveal")).toHaveCount(0);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await arena.getByRole("button", { name: "Ver drops", exact: true }).click();
      await expect(arena.locator(".arena-loot-card")).toBeVisible();
      expect(
        await arena
          .locator(".arena-loot-card")
          .evaluate((el) => getComputedStyle(el).animationName),
      ).toBe("none");
      const after = await state();
      expect(after.inventory).toEqual(before.inventory);
      expect(after.character.xp).toBe(before.character.xp);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(errors).toEqual([]);
    } finally {
      if (ownerId) {
        await database.db.delete(s.user).where(eq(s.user.id, ownerId));
        await database.db.delete(s.rateLimit).where(eq(s.rateLimit.key, `game:${ownerId}`));
      }
      await database.pool.end();
    }
  });
