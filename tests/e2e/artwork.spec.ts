import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { createDatabase } from "../../src/server/db/client";
import * as s from "../../src/server/db/schema";

const email = `artwork-${randomUUID()}@example.test`;
const database = createDatabase(process.env.DATABASE_URL!);

test.afterAll(async () => {
  try {
    const [owner] = await database.db.select().from(s.user).where(eq(s.user.email, email));
    if (owner) {
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
  await page.getByRole("button", { name: label, exact: true }).click();
}

async function loadedImages(page: Page, selector: string, count: number) {
  await expect(page.locator(selector)).toHaveCount(count);
  for (const image of await page.locator(selector).all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate((element) => {
          const image = element as HTMLImageElement;
          return image.complete && image.naturalWidth > 0;
        }),
      )
      .toBe(true);
  }
}

test("artes carregam e permanecem inteiras no login, hero, inventário e transformações", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mkdir(".local/screenshots", { recursive: true });

  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/login");
    await loadedImages(page, ".auth-fighters img", 3);
    expect(
      await page.locator(".auth-fighters").evaluate((container) => {
        const bounds = container.getBoundingClientRect();
        return Array.from(container.querySelectorAll("img")).every((image) => {
          const rect = image.getBoundingClientRect();
          return (
            rect.left >= bounds.left - 1 &&
            rect.right <= bounds.right + 1 &&
            rect.top >= bounds.top - 1 &&
            rect.bottom <= bounds.bottom + 1 &&
            getComputedStyle(image).objectFit === "contain"
          );
        });
      }),
    ).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `.local/screenshots/art-login-${width}.png`, fullPage: true });
  }

  const signup = await page.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL! },
    data: { email, password: randomUUID() + "Test!", name: "Arte Teste" },
  });
  expect(signup.ok()).toBe(true);
  const created = await page.request.post("/api/game/characters", {
    headers: { origin: baseURL! },
    data: { name: "Guerreiro Arte", raceId: "saiyajin", idempotencyKey: randomUUID() },
  });
  expect(created.ok()).toBe(true);
  const initial = await (await page.request.get("/api/game")).json();
  const character = initial.snapshot.character;
  // Somente a conta descartável deste teste recebe os itens necessários à revisão visual.
  await database.db
    .insert(s.inventory)
    .values(
      [
        "bastao",
        "pocao-hp",
        "pocao-ki",
        "semente-deuses",
        "armadura-simples",
        "armadura-saiyajin",
      ].map((itemId) => ({ characterId: character.id, itemId, quantity: 1 })),
    );
  await page.goto("/jogo");
  await expect(page.getByRole("heading", { name: "Olá, Guerreiro Arte." })).toBeVisible();
  const background = await page.request.get("/images/world/terra-shenron.webp");
  expect(background.ok()).toBe(true);

  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await go(page, "Personagem");
    await expect(page.locator(".hero-fighter-names")).toContainText("PICCOLO");
    expect(
      await page.locator(".hero-fighter-names").evaluate((container) => {
        const hero = container.closest(".lobby-hero")!.getBoundingClientRect();
        const buttons = Array.from(container.closest(".lobby-hero")!.querySelectorAll("button"));
        const labels = Array.from(container.children);
        return labels.every((label, index) => {
          const rect = label.getBoundingClientRect();
          return (
            rect.left >= hero.left &&
            rect.right <= hero.right &&
            rect.bottom <= hero.bottom &&
            label.scrollWidth <= label.clientWidth &&
            buttons.every((button) => {
              const bounds = button.getBoundingClientRect();
              return (
                rect.right <= bounds.left ||
                rect.left >= bounds.right ||
                rect.bottom <= bounds.top ||
                rect.top >= bounds.bottom
              );
            }) &&
            (!index || labels[index - 1].getBoundingClientRect().right <= rect.left)
          );
        });
      }),
    ).toBe(true);
    await page.screenshot({ path: `.local/screenshots/art-home-${width}.png`, fullPage: true });

    await go(page, "Inventário");
    await loadedImages(page, ".inventory-card .item-showcase img", 6);
    await expect(
      page
        .locator(".inventory-card")
        .filter({ hasText: "Bastão" })
        .getByRole("button", { name: "Equipar", exact: true }),
    ).toBeEnabled();
    await page.screenshot({
      path: `.local/screenshots/art-inventory-${width}.png`,
      fullPage: true,
    });

    await go(page, "Transformações");
    await loadedImages(page, ".transformation-portrait img", 2);
    await expect(page.locator(".transformation-card > .badge")).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `.local/screenshots/art-transformations-${width}.png`,
      fullPage: true,
    });
  }
  // A navegação e as artes não alteram o progresso do personagem.
  const after = await (await page.request.get("/api/game")).json();
  expect(after.snapshot.character.xp).toBe(character.xp);
  expect(after.snapshot.character.zeni).toBe(character.zeni);
  expect(after.snapshot.stats.powerLevel).toBe(initial.snapshot.stats.powerLevel);

  // Troca de raça exclusiva da fixture para conferir a galeria de Freeza.
  await database.db
    .update(s.characters)
    .set({ raceId: "freeza" })
    .where(eq(s.characters.id, character.id));
  await page.reload();
  await go(page, "Transformações");
  await loadedImages(page, ".transformation-portrait img", 1);
  await expect(
    page.getByRole("img", { name: "Freeza em sua forma dourada Golden Freeza" }),
  ).toBeVisible();
  await page.screenshot({ path: ".local/screenshots/art-golden-freeza.png", fullPage: true });
  expect(errors).toEqual([]);
});
