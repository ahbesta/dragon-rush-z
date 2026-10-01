import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { createDatabase } from "../../src/server/db/client";
import * as s from "../../src/server/db/schema";

const email = `activity-art-${randomUUID()}@example.test`;
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

test("cenas animadas apenas na atividade em andamento, na página e visíveis", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mkdir(".local/screenshots", { recursive: true });
  const signup = await page.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL! },
    data: { email, password: randomUUID() + "Test!", name: "Animação Teste" },
  });
  expect(signup.ok()).toBe(true);
  const created = await page.request.post("/api/game/characters", {
    headers: { origin: baseURL! },
    data: { name: "Aluno do Kame", raceId: "saiyajin", idempotencyKey: randomUUID() },
  });
  expect(created.ok()).toBe(true);
  await page.goto("/jogo");
  await go(page, "Treinamento");
  await expect(page.locator("[data-activity-animation]")).toHaveCount(0);
  await page.getByRole("button", { name: "Iniciar treinamento", exact: true }).click();
  const training = page.locator('[data-activity-animation="training"]');
  await expect(training).toHaveCount(1);
  await training.scrollIntoViewIfNeeded();
  await expect(training).toHaveAttribute("data-playing", "true");
  await expect(page.locator('[data-activity-animation="rest"]')).toHaveCount(0);
  const frames = training.locator("img");
  expect(await frames.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBe(3840);
  const firstFrame = await frames.evaluate((img) => getComputedStyle(img).transform);
  await expect
    .poll(() => frames.evaluate((img) => getComputedStyle(img).transform))
    .not.toBe(firstFrame);
  await page.screenshot({
    path: ".local/screenshots/training-animated-desktop.png",
    fullPage: true,
  });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() => frames.evaluate((img) => getComputedStyle(img).animationName))
    .toBe("none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect
    .poll(() => frames.evaluate((img) => getComputedStyle(img).animationName))
    .toBe("activity-scene-frames");

  // Simulate the browser's visibility event without changing the server activity.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(training).toHaveAttribute("data-playing", "false");
  await expect
    .poll(() => frames.evaluate((img) => getComputedStyle(img).animationPlayState))
    .toBe("paused");
  await page.evaluate(() => {
    delete (document as unknown as { visibilityState?: string }).visibilityState;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(training).toHaveAttribute("data-playing", "true");

  await page.setViewportSize({ width: 390, height: 700 });
  await training.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: ".local/screenshots/training-animated-mobile.png",
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator(".training-tip").scrollIntoViewIfNeeded();
  await expect(training).toHaveAttribute("data-playing", "false");
  await training.scrollIntoViewIfNeeded();
  await expect(training).toHaveAttribute("data-playing", "true");
  await go(page, "Personagem");
  await expect(page.locator("[data-activity-animation]")).toHaveCount(0);
  await page.reload();
  await go(page, "Treinamento");
  await expect(training).toHaveCount(1);
  await training.scrollIntoViewIfNeeded();
  await expect(training).toHaveAttribute("data-playing", "true");
  await expect(training).toHaveCount(0, { timeout: 45000 });
  // Expiry stops animation; claiming XP still needs the existing server action.
  let state = await (await page.request.get("/api/game")).json();
  expect(state.snapshot.activity.kind).toBe("training");
  await page.getByRole("button", { name: "Concluir atividade", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Treinamento concluído" })).toBeVisible();
  await expect(page.locator("[data-activity-animation]")).toHaveCount(0);

  await page.getByRole("button", { name: /^Descansar por/ }).click();
  const rest = page.locator('[data-activity-animation="rest"]');
  await rest.scrollIntoViewIfNeeded();
  await expect(rest).toHaveAttribute("data-playing", "true");
  await expect(training).toHaveCount(0);
  await page.screenshot({ path: ".local/screenshots/rest-animated-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await rest.scrollIntoViewIfNeeded();
  await expect(rest).toHaveAttribute("data-playing", "true");
  await page.screenshot({ path: ".local/screenshots/rest-animated-desktop.png", fullPage: true });
  await go(page, "Explorar");
  await expect(page.locator("[data-activity-animation]")).toHaveCount(0);
  await go(page, "Treinamento");
  await expect(rest).toHaveCount(1);
  await expect(rest).toHaveCount(0, { timeout: 30000 });
  await page.getByRole("button", { name: "Concluir atividade", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Descanso concluído" })).toBeVisible();
  state = await (await page.request.get("/api/game")).json();
  expect(state.snapshot.activity).toBeNull();
  expect(state.snapshot.character.hp).toBe(state.snapshot.stats.maxHp);
  expect(state.snapshot.character.ki).toBe(state.snapshot.stats.maxKi);
  expect(errors).toEqual([]);
});
