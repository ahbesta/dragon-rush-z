import { test, expect } from "./browser-test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { createDatabase } from "../../src/server/db/client";
import * as s from "../../src/server/db/schema";

const email = `login-redesign-${randomUUID()}@example.test`;
const password = randomUUID() + "Test!";
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

test("nova abertura: arte exclusiva inteira, login/cadastro real, erros e sessão persistente", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(120000);
  await mkdir(".local/screenshots", { recursive: true });
  const errors: string[] = [];
  const images: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.resourceType() !== "image") return;
    const url = new URL(request.url());
    images.push(url.searchParams.get("url") ?? url.pathname);
  });
  await page.goto("/jogo");
  await expect(page).toHaveURL(/\/login/);
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [768, 900],
    [1024, 768],
    [1440, 900],
    [1920, 900],
    [2560, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(() =>
        page.locator(".entry-illustration").evaluate((el) => {
          const image = el as HTMLImageElement;
          return image.complete && image.naturalWidth > 0;
        }),
      )
      .toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      await page.locator(".entry-screen").evaluate((el) => {
        const image = el.querySelector(".entry-illustration")!.getBoundingClientRect();
        const scenery = el.querySelector(".entry-scenery")!.getBoundingClientRect();
        const panel = el.querySelector(".entry-panel")!.getBoundingClientRect();
        // Full Goku + Nimbus silhouette in the reviewed 1672×941 artwork.
        const hero = {
          left: image.left + (image.width * 117) / 1672,
          right: image.left + (image.width * 880) / 1672,
          top: image.top + (image.height * 147) / 941,
          bottom: image.top + (image.height * 850) / 941,
        };
        const formIsSeparate =
          hero.right <= panel.left || panel.right <= hero.left || hero.bottom <= panel.top;
        const sameAspect = Math.abs(image.width / image.height - 1672 / 941) < 0.001;
        return (
          sameAspect &&
          hero.left >= scenery.left &&
          hero.right <= scenery.right &&
          hero.top >= scenery.top &&
          hero.bottom <= scenery.bottom &&
          formIsSeparate
        );
      }),
      `Goku and Nimbus fully visible at ${width}×${height}`,
    ).toBe(true);
    const button = page.getByRole("button", { name: "Entrar no jogo", exact: true });
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeInViewport();
    await page.screenshot({ path: `.local/screenshots/login-final-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Criar conta", exact: true }).click();
    await expect(page.getByLabel("Seu nome", { exact: true })).toBeVisible();
    await page.screenshot({ path: `.local/screenshots/signup-final-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
  }
  expect(images.some((path) => path.includes("/images/login/nimbus-journey.webp"))).toBe(true);
  expect(
    images.filter((path) => /\/images\/(characters|races|world-map|scenes|world)\//.test(path)),
  ).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await page.getByLabel("Seu nome", { exact: true }).fill("Guerreiro Login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Criar minha conta", exact: true }).click();
  await expect(page).toHaveURL(/\/jogo/);
  await expect(page.getByRole("heading", { name: /Todo poder tem uma/ })).toBeVisible();
  // Login styles must stay scoped after the client-side transition to the game.
  await expect(page.locator(".entry-screen")).toHaveCount(0);
  await page.reload();
  await expect(page).toHaveURL(/\/jogo/);
  await page.goto("/login");
  await expect(page).toHaveURL(/\/jogo/);
  expect(
    (
      await page.request.post("/api/auth/sign-out", { headers: { origin: baseURL! }, data: {} })
    ).ok(),
  ).toBe(true);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("InvalidTestPassword!");
  await page.getByRole("button", { name: "Entrar no jogo", exact: true }).click();
  await expect(page.locator(".entry-panel").getByRole("alert")).toContainText(
    "Email ou senha inválidos",
  );
  await expect(page.getByRole("button", { name: "Entrar no jogo", exact: true })).toBeEnabled();
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar no jogo", exact: true }).click();
  await expect(page).toHaveURL(/\/jogo/);
  await page.reload();
  await expect(page.getByRole("heading", { name: /Todo poder tem uma/ })).toBeVisible();
  expect(errors).toEqual([]);
});
