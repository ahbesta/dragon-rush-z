import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { createDatabase } from "../../src/server/db/client";
import * as s from "../../src/server/db/schema";
import { ambientSprites, ambientActors } from "../../src/lib/world-map-ambience";

const email = `map-life-${randomUUID()}@example.test`;
const database = createDatabase(process.env.DATABASE_URL!);

test.afterAll(async () => {
  try {
    const [user] = await database.db.select().from(s.user).where(eq(s.user.email, email));
    if (user) {
      await database.db.delete(s.user).where(eq(s.user.id, user.id));
      await database.db.delete(s.rateLimit).where(eq(s.rateLimit.key, `game:${user.id}`));
    }
  } finally {
    await database.pool.end();
  }
});

test("vida do mapa: sprites completos, animação, pausas, acessibilidade e composição responsiva", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  let actions = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/game/actions")) actions++;
  });

  for (const sprite of Object.values(ambientSprites)) {
    const { data, info } = await sharp(`public${sprite.src}`)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(sprite.frameWidth * 4);
    expect(info.height).toBe(sprite.frameHeight);
    for (let frame = 0; frame < 4; frame++) {
      let opaque = 0;
      let left = sprite.frameWidth,
        right = -1,
        top = info.height,
        bottom = -1;
      for (let y = 0; y < info.height; y++)
        for (let x = 0; x < sprite.frameWidth; x++) {
          const alpha = data[(y * info.width + frame * sprite.frameWidth + x) * 4 + 3];
          if (alpha > 40) {
            opaque++;
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
        }
      expect(opaque).toBeGreaterThan(150);
      expect(opaque).toBeLessThan(sprite.frameWidth * sprite.frameHeight * 0.85);
      expect(left, `${sprite.src} frame ${frame} margin`).toBeGreaterThan(1);
      expect(right).toBeLessThan(sprite.frameWidth - 2);
      expect(top).toBeGreaterThan(1);
      expect(bottom).toBeLessThan(sprite.frameHeight - 2);
    }
  }

  const signup = await page.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL! },
    data: { email, password: `${randomUUID()}Test!`, name: "Teste Cenário" },
  });
  expect(signup.ok()).toBe(true);
  const created = await page.request.post("/api/game/characters", {
    headers: { origin: baseURL! },
    data: { name: "Viajante", raceId: "saiyajin", idempotencyKey: randomUUID() },
  });
  expect(created.ok()).toBe(true);
  const before = (await (await page.request.get("/api/game")).json()).snapshot;
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/jogo");
  const ambience = page.locator(".world-map-ambience");
  const map = page.locator(".world-map-frame");
  await map.scrollIntoViewIfNeeded();
  await expect(ambience).toHaveAttribute("aria-hidden", "true");
  await expect(ambience).toHaveAttribute("inert", "");
  await expect(ambience).toHaveAttribute("data-playing", "true");
  await expect(ambience.locator('.map-life-actor[data-ready="true"]')).toHaveCount(
    ambientActors.length,
  );
  await expect
    .poll(() =>
      ambience
        .locator("img")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  expect(await ambience.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe(
    "none",
  );

  await mkdir(".local/screenshots/map-life", { recursive: true });
  for (const phase of [0.05, 0.28, 0.53, 0.78]) {
    await ambience.evaluate((element, phase) => {
      for (const animation of element.getAnimations({ subtree: true })) {
        animation.pause();
        const duration = Number(animation.effect?.getTiming().duration ?? 1000);
        animation.currentTime = duration * phase;
      }
    }, phase);
    await map.screenshot({ path: `.local/screenshots/map-life/desktop-phase-${phase}.png` });
  }
  for (const width of [1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await map.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await map.screenshot({ path: `.local/screenshots/map-life/map-${width}.png` });
    if (width < 700) {
      await page.locator(".world-map-scroll").evaluate((element) => {
        element.scrollLeft = 0;
      });
      await map.screenshot({ path: `.local/screenshots/map-life/coast-${width}.png` });
      await page.locator(".world-map-scroll").evaluate((element) => {
        element.scrollLeft = element.scrollWidth;
      });
      await map.screenshot({ path: `.local/screenshots/map-life/village-${width}.png` });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await ambience.evaluate((element) =>
    element.getAnimations({ subtree: true }).forEach((animation) => animation.play()),
  );
  const frames = ambience.locator('[data-actor="predator"] img');
  await expect
    .poll(() => frames.evaluate((image) => getComputedStyle(image).animationPlayState))
    .toBe("running");
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(ambience).toHaveAttribute("data-playing", "false");
  await expect
    .poll(() => frames.evaluate((image) => getComputedStyle(image).animationPlayState))
    .toBe("paused");
  await page.evaluate(() => {
    delete (document as unknown as { visibilityState?: string }).visibilityState;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(ambience).toHaveAttribute("data-playing", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() => frames.evaluate((image) => getComputedStyle(image).animationName))
    .toBe("none");
  await page.getByRole("button", { name: "Ir para Explorar", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(ambience).toHaveAttribute("data-playing", "false");
  await page.keyboard.press("Escape");
  await expect(ambience).toHaveAttribute("data-playing", "true");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 600 });
  await page
    .locator("#character-sheet")
    .evaluate((element) => element.scrollIntoView({ block: "start" }));
  await expect(ambience).toHaveAttribute("data-playing", "false");
  await map.scrollIntoViewIfNeeded();
  await expect(ambience).toHaveAttribute("data-playing", "true");
  const after = (await (await page.request.get("/api/game")).json()).snapshot;
  expect(after.character).toEqual(before.character);
  expect(after.inventory).toEqual(before.inventory);
  expect(actions).toBe(0);
  await page.getByRole("button", { name: "Inventário", exact: true }).click();
  await expect(ambience).toHaveCount(0);
  expect(errors).toEqual([]);
});
