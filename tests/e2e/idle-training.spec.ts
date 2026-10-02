import { test, expect } from "./browser-test";
import type { Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { createDatabase } from "../../src/server/db/client";
import * as s from "../../src/server/db/schema";
import { expectFullActivityScene } from "./activity-scene";
import type { GameSnapshot } from "../../src/game/types";

const database = createDatabase(process.env.DATABASE_URL!);
const emails: string[] = [];
test.afterAll(async () => {
  try {
    for (const email of emails) {
      const [owner] = await database.db.select().from(s.user).where(eq(s.user.email, email));
      if (!owner) continue;
      await database.db.delete(s.user).where(eq(s.user.id, owner.id));
      await database.db.delete(s.rateLimit).where(eq(s.rateLimit.key, `game:${owner.id}`));
    }
  } finally {
    await database.pool.end();
  }
});
async function go(page: Page, label: string) {
  const menu = page.getByRole("button", { name: "Abrir menu", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.locator("#game-navigation").getByRole("button", { name: label, exact: true }).click();
}
async function state(page: Page): Promise<GameSnapshot> {
  return (await (await page.request.get("/api/game")).json()).snapshot;
}

for (const width of [390, 1440]) {
  test(`treinamento idle: mestres, desbloqueios, cenas e coleta offline em ${width}px`, async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(120000);
    await mkdir(".local/screenshots", { recursive: true });
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const email = `idle-training-${randomUUID()}@example.test`;
    emails.push(email);
    const headers = { origin: baseURL! };
    expect(
      (
        await page.request.post("/api/auth/sign-up/email", {
          headers,
          data: { email, password: randomUUID() + "Test!", name: "Aluno" },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await page.request.post("/api/game/characters", {
          headers,
          data: { name: "Aluno", raceId: "saiyajin", idempotencyKey: randomUUID() },
        })
      ).ok(),
    ).toBe(true);
    await page.goto("/jogo");
    await go(page, "Treinamento");
    const route = page.getByRole("navigation", { name: "Locais de treinamento" });
    await expect(route.getByRole("button")).toHaveCount(4);
    await route.getByRole("button").nth(2).click();
    const stage = page.locator(".training-stage");
    await expect(stage).toContainText("Reflexos de Karin");
    await expect(stage).toContainText("Vencer Karin · prova");
    await expect(
      stage.getByRole("button", { name: "Iniciar treinamento", exact: true }),
    ).toHaveCount(0);
    const locked = await page.request.post("/api/game/actions", {
      headers,
      data: { action: "training.start", trainingId: "karin", idempotencyKey: randomUUID() },
    });
    expect(locked.status()).toBe(403);
    await stage.screenshot({ path: `.local/screenshots/idle-training-karin-locked-${width}.png` });

    // Simulate completed story challenges for this disposable character only.
    const initial = await state(page);
    await database.db
      .update(s.characters)
      .set({
        level: 25,
        flags: [
          "master:kame",
          "quest:prova-kame",
          "defeated:prova-kame",
          "master:karin",
          "quest:karin",
          "defeated:prova-karin",
          "quest:daimao",
          "defeated:piccolo-daimao",
        ],
      })
      .where(eq(s.characters.id, initial.character.id));
    await page.reload();
    await go(page, "Treinamento");
    for (const [index, id, art] of [
      [0, "kame-basic", "kame"],
      [1, "kame-weights", "kame"],
      [2, "karin", "karin"],
      [3, "popo", "popo"],
    ] as const) {
      await route.getByRole("button").nth(index).click();
      await expect(route.getByRole("button").nth(index)).toHaveAttribute("aria-pressed", "true");
      const before = await state(page);
      await stage.getByRole("button", { name: "Iniciar treinamento", exact: true }).click();
      const animation = stage.locator('[data-activity-animation="training"]');
      await expect(animation).toHaveCount(1);
      await animation.scrollIntoViewIfNeeded();
      await expect(animation).toHaveAttribute("data-playing", "true");
      await expect(animation.locator("img")).toHaveAttribute(
        "src",
        new RegExp(`/images/activities/treino-${art}-v3\\.webp$`),
      );
      await expect
        .poll(() =>
          animation.locator("img").evaluate((img) => (img as HTMLImageElement).naturalWidth),
        )
        .toBe(4800);
      await expectFullActivityScene(animation, 900);
      await expect(stage.getByRole("button", { name: /Coleta em \d+s/ })).toBeDisabled();
      await expect(stage.getByRole("status")).toContainText("Próximo XP em");
      await expect(
        stage.getByRole("progressbar", { name: "Tempo de treinamento" }),
      ).toHaveAttribute("aria-valuemax", "86400");
      await stage.screenshot({ path: `.local/screenshots/idle-training-${id}-${width}.png` });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const pending = await state(page);
      expect(pending.character.xp).toBe(before.character.xp);
      expect(pending.activity!.training!.trainingId).toBe(id);
      await go(page, "Personagem");
      await expect(page.locator("[data-activity-animation]")).toHaveCount(0);
      // The first session is collected early; the others use an expired one-hour fixture.
      // A reload reconstructs both forms from the database without granting XP.
      await database.db
        .update(s.activities)
        .set(
          index === 0
            ? { startedAt: new Date(Date.now() - 900000) }
            : { startedAt: new Date(0), finishesAt: new Date(3600000) },
        )
        .where(eq(s.activities.id, pending.activity!.id));
      await page.reload();
      const notification = page.getByRole("dialog", { name: "Treino finalizado!", exact: true });
      if (index > 0) {
        await expect(notification).toBeVisible();
        await notification.getByRole("button", { name: /Depois/ }).click();
      } else {
        await expect(notification).not.toBeVisible();
      }
      await go(page, "Treinamento");
      if (index > 0) {
        await expect(stage.getByRole("status")).toContainText(
          `+${pending.activity!.training!.xpPerHour}`,
        );
        await expect(page.locator("[data-activity-animation]")).toHaveCount(0);
      } else {
        await expect(page.locator("[data-activity-animation]")).toHaveCount(1);
        await expect(stage.getByRole("button", { name: /Coletar .* XP e encerrar/ })).toBeEnabled();
        expect((await state(page)).character.xp).toBe(before.character.xp);
      }
      await stage.getByRole("button", { name: /Coletar .* XP e encerrar/ }).click();
      await expect.poll(async () => (await state(page)).activity).toBeNull();
      const earned = (await state(page)).character.xp - before.character.xp;
      if (index > 0) expect(earned).toBe(pending.activity!.training!.xpPerHour);
      else {
        expect(earned).toBe(9);
      }
    }
    expect(errors).toEqual([]);
  });
}
