import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { createDatabase } from "../../src/server/db/client";
import * as s from "../../src/server/db/schema";
import { applyExperience } from "../../src/game/progression";
import { deriveStats } from "../../src/game/attributes";
import type { GameSnapshot } from "../../src/game/types";

const email = `world-map-${randomUUID()}@example.test`;
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

test("mapa: raças, caminhada, destinos, áreas, teclado, mercado e atividades reais", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mkdir(".local/screenshots", { recursive: true });
  const signup = await page.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL! },
    data: { email, password: randomUUID() + "Test!", name: "Teste Mapa" },
  });
  expect(signup.ok()).toBe(true);
  const created = await page.request.post("/api/game/characters", {
    headers: { origin: baseURL! },
    data: { name: "Viajante da Terra", raceId: "saiyajin", idempotencyKey: randomUUID() },
  });
  expect(created.ok()).toBe(true);
  const initial: GameSnapshot = (await (await page.request.get("/api/game")).json()).snapshot;
  const progress = applyExperience(1, 0, 100, initial.race.base, initial.race);
  const stats = deriveStats(progress.base, progress.level);
  await database.db
    .update(s.characters)
    .set({ ...progress, hp: stats.maxHp, ki: stats.maxKi })
    .where(eq(s.characters.id, initial.character.id));
  await page.goto("/jogo");
  const map = page.locator(".world-map");
  const avatar = page.locator(".world-map-avatar");
  await expect(map).toBeVisible();
  await expect(map.locator(".world-map-node")).toHaveCount(7);
  await expect
    .poll(() =>
      map
        .locator(".world-map-background")
        .evaluate(
          (image) =>
            (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
        ),
    )
    .toBe(true);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('24px "Saiyan Sans"'))).toBe(true);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      await map.locator(".world-map-canvas").evaluate((canvas) => {
        const outer = canvas.getBoundingClientRect();
        const buttons = [...canvas.querySelectorAll(".world-map-node")].map((node) =>
          node.getBoundingClientRect(),
        );
        return (
          buttons.every(
            (rect) =>
              rect.left >= outer.left &&
              rect.right <= outer.right &&
              rect.top >= outer.top &&
              rect.bottom <= outer.bottom,
          ) &&
          buttons.every((a, i) =>
            buttons
              .slice(i + 1)
              .every(
                (b) =>
                  a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top,
              ),
          )
        );
      }),
    ).toBe(true);
    await page.screenshot({ path: `.local/screenshots/map-${width}.png`, fullPage: true });
  }

  let posts = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/game/actions")) posts++;
  });
  const real: GameSnapshot = (await (await page.request.get("/api/game")).json()).snapshot;
  for (const race of real.catalog.races) {
    const visual = structuredClone(real);
    visual.character.raceId = race.id;
    visual.race = race;
    await page.route("**/api/game", (route) => route.fulfill({ json: { snapshot: visual } }));
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(avatar).toHaveAttribute("data-race", race.id);
    await expect(avatar.locator("img")).toHaveAttribute(
      "src",
      new RegExp(`/images/world-map/${race.id}\\.webp$`),
    );
    await expect
      .poll(() => avatar.locator("img").evaluate((img) => (img as HTMLImageElement).naturalWidth))
      .toBe(384);
    await map.getByRole("button", { name: "Ir para Explorar", exact: true }).click();
    await expect(avatar).toHaveAttribute("data-walking", "true");
    await expect
      .poll(() => avatar.locator("img").evaluate((img) => getComputedStyle(img).animationName))
      .toBe("map-walk-cycle");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(avatar).toHaveAttribute("data-walking", "false");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await map.screenshot({ path: `.local/screenshots/map-race-${race.id}.png` });
    await page.unroute("**/api/game");
  }
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(avatar).toHaveAttribute("data-race", "saiyajin");
  await map.getByRole("button", { name: "Ir para Batalhar", exact: true }).click();
  await expect(avatar).toHaveAttribute("data-walking", "true");
  // Retargeting a trip cancels its old completion callback.
  await map.getByRole("button", { name: "Mapa: Explorar", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText("Escolha uma área para explorar e encontrar seus inimigos."),
  ).toBeVisible();
  await expect(dialog.locator(".map-area-option")).toHaveCount(real.catalog.areas.length);
  await expect(dialog.getByRole("button", { name: /Região da Red Ribbon/ })).toBeDisabled();
  await dialog.screenshot({ path: ".local/screenshots/map-area-desktop.png" });
  await page.keyboard.press("Tab");
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await dialog.getByRole("button", { name: /Montanhas/ }).click();
  await expect(page.getByRole("heading", { name: "Explorar", exact: true })).toBeVisible();
  await expect(
    page.locator(".encounter-panel").getByRole("heading", { name: "Montanhas", exact: true }),
  ).toBeVisible();
  expect(posts).toBe(0);

  await go(page, "Personagem");
  await page.setViewportSize({ width: 390, height: 800 });
  await page.getByRole("button", { name: "Mapa: Batalhar", exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.screenshot({ path: ".local/screenshots/map-area-mobile.png" });
  await dialog.getByRole("button", { name: /Floresta/ }).click();
  await expect(page.getByRole("heading", { name: "Batalhar", exact: true })).toBeVisible();
  await expect(page.locator(".enemy-row").filter({ hasText: "Lobo" })).toBeVisible();
  expect(posts).toBe(0);
  await go(page, "Personagem");
  await page.getByRole("button", { name: "Mapa: Mercado", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Mercado de técnicas", exact: true }),
  ).toBeVisible();
  const technique = page.locator(".technique-card").filter({ hasText: "Rajada de Ki" });
  await technique.getByRole("button", { name: "Aprender · 30 Zeni", exact: true }).click();
  await expect(technique.getByText("APRENDIDA", { exact: true })).toBeVisible();
  const purchased: GameSnapshot = (await (await page.request.get("/api/game")).json()).snapshot;
  expect(purchased.character.zeni).toBe(real.character.zeni - 30);
  expect(purchased.learnedTechniques).toContain("rajada-ki");

  await go(page, "Personagem");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Mapa: Inventário", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Inventário", exact: true })).toBeVisible();
  await go(page, "Personagem");
  await page.getByRole("button", { name: "Mapa: Personagem", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator("#character-sheet")
        .evaluate((element) => Math.abs(element.getBoundingClientRect().top - 24)),
    )
    .toBeLessThan(3);
  await page.getByRole("button", { name: "Mapa: Treinamento", exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Iniciar treinamento", exact: true }).click();
  await expect(page.locator('[data-activity-animation="training"]')).toBeAttached();
  await go(page, "Personagem");
  await page.getByRole("button", { name: "Mapa: Descansar", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Iniciar descanso", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Ver treinamento e descanso", exact: true }).click();
  await page
    .getByRole("button", { name: "Concluir atividade", exact: true })
    .click({ timeout: 45000 });
  await expect(page.getByRole("status").filter({ hasText: "Treinamento concluído" })).toBeVisible();
  await go(page, "Personagem");
  await page.getByRole("button", { name: "Mapa: Descansar", exact: true }).click();
  await dialog.getByRole("button", { name: "Iniciar descanso", exact: true }).click();
  await expect(page.locator('[data-activity-animation="rest"]')).toBeAttached();
  expect(errors).toEqual([]);
});
