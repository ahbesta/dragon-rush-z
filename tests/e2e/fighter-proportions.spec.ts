import { test, expect } from "./browser-test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { createDatabase } from "../../src/server/db/client";
import * as s from "../../src/server/db/schema";
import { enemyBattleSprites, playerBattleSprites } from "../../src/lib/game-art";
import type { GameSnapshot } from "../../src/game/types";

const email = `fighter-proportions-${randomUUID()}@example.test`;
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

test("all fighters: logical relative heights, undistorted artwork, grounded feet and responsive fit", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180000);
  await mkdir(".local/screenshots", { recursive: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const headers = { origin: baseURL! };
  const signup = await page.request.post("/api/auth/sign-up/email", {
    headers,
    data: { email, password: randomUUID() + "Test!", name: "Teste Proporções" },
  });
  expect(signup.ok()).toBe(true);
  const created = await page.request.post("/api/game/characters", {
    headers,
    data: { name: "Guerreiro Escala", raceId: "saiyajin", idempotencyKey: randomUUID() },
  });
  expect(created.ok()).toBe(true);
  const original: GameSnapshot = (await (await page.request.get("/api/game")).json()).snapshot;
  let visual = structuredClone(original);
  // Only browser GET responses are substituted. The real account never receives fake wins.
  await page.route("**/api/game", (route) => route.fulfill({ json: { snapshot: visual } }));
  await page.goto("/jogo");
  const go = async () => {
    const menu = page.getByRole("button", { name: "Abrir menu", exact: true });
    if (await menu.isVisible()) await menu.click();
    await page
      .locator("#game-navigation")
      .getByRole("button", { name: "Batalhar", exact: true })
      .click();
  };
  await go();
  const cases = [
    ...Object.keys(enemyBattleSprites).map((enemyId) => ({
      enemyId,
      raceId: "saiyajin",
      id: enemyId,
    })),
    ...Object.keys(playerBattleSprites).map((raceId) => ({
      enemyId: "bandido",
      raceId,
      id: raceId,
    })),
  ];
  for (const { enemyId, raceId, id } of cases) {
    const enemy = original.catalog.enemies.find((enemy) => enemy.id === enemyId)!;
    expect(enemy, `missing fighter catalog entry: ${enemyId}`).toBeDefined();
    const race = original.catalog.races.find((race) => race.id === raceId)!;
    visual = structuredClone(original);
    visual.character.raceId = raceId;
    visual.race = race;
    visual.latestBattle = {
      version: 2,
      id: `proportions-${id}`,
      enemyId,
      areaId: "floresta",
      outcome: "victory",
      playerHp: original.stats.maxHp,
      playerKi: original.stats.maxKi,
      xp: 0,
      zeni: 0,
      drops: [],
      events: [
        {
          seq: 0,
          round: 0,
          type: "start",
          player: original.character.name,
          enemy: enemy.name,
          playerHp: original.stats.maxHp,
          enemyHp: enemy.maxHp,
          playerKi: original.stats.maxKi,
          enemyKi: enemy.maxKi,
        },
        { seq: 1, round: 1, type: "end", outcome: "victory" },
      ],
    };
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    const arena = page.locator(".battle-arena");
    await expect(arena).toHaveAttribute("data-battle-id", `proportions-${id}`);
    const playerSprite = playerBattleSprites[raceId]!;
    const enemySprite = enemyBattleSprites[enemyId]!;
    await expect(arena.locator(".player .arena-sprite-sheet")).toHaveAttribute(
      "src",
      playerSprite.src,
    );
    await expect(arena.locator(".enemy .arena-sprite-sheet")).toHaveAttribute(
      "src",
      enemySprite.src,
    );
    for (const image of await arena.locator(".arena-sprite-sheet").all())
      await expect
        .poll(() =>
          image.evaluate(
            (el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0,
          ),
        )
        .toBe(true);
    const stage = arena.locator(".battle-stage");
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1100 });
      const metrics = await stage.evaluate(
        (element, sprites) => {
          const field = element.getBoundingClientRect();
          return sprites.map((sprite, index) => {
            const window = element
              .querySelectorAll(".arena-sprite-window")
              [index].getBoundingClientRect();
            const image = element.querySelectorAll(".arena-sprite-sheet")[
              index
            ] as HTMLImageElement;
            const art = image.getBoundingClientRect();
            const bounds = sprite.bounds![0];
            const pixelScale = art.height / image.naturalHeight;
            return {
              visibleHeight: (bounds.bottom - bounds.top + 1) * pixelScale,
              foot: art.top + (bounds.bottom + 1) * pixelScale,
              baseline: window.bottom,
              aspect: art.width / art.height,
              naturalAspect: image.naturalWidth / image.naturalHeight,
              fits:
                window.left >= field.left - 1 &&
                window.right <= field.right + 1 &&
                window.top >= field.top &&
                window.bottom <= field.bottom,
            };
          });
        },
        [playerSprite, enemySprite],
      );
      expect(
        metrics[1].visibleHeight / metrics[0].visibleHeight,
        `${id} at ${width}px`,
      ).toBeCloseTo(enemySprite.scale / playerSprite.scale, 2);
      expect(Math.abs(metrics[0].foot - metrics[1].foot), `${id}: aligned feet`).toBeLessThan(1);
      for (const metric of metrics) {
        expect(metric.aspect).toBeCloseTo(metric.naturalAspect, 2);
        expect(Math.abs(metric.foot - metric.baseline)).toBeLessThan(1);
        expect(metric.fits, `${id} fits ${width}px`).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (
        width === 1440 ||
        (width === 390 &&
          [
            "chaos",
            "major-metallic",
            "robo-pirata",
            "dinossauro",
            "prova-karin",
            "pilaf",
            "majin",
          ].includes(id))
      )
        await stage.screenshot({ path: `.local/screenshots/proportions-${id}-${width}.png` });
      if (
        [320, 1440].includes(width) &&
        ["dinossauro", "robo-pirata", "major-metallic", "buyon", "majin"].includes(id)
      ) {
        for (const count of [2, 3, 5]) {
          // Reserve cells for future groups without adding combatants to game state.
          await stage.evaluate((element, count) => {
            const columns = element.getBoundingClientRect().width > 760 ? 2 : 1;
            (element as HTMLElement).style.setProperty(
              "--formation-rows",
              String(Math.ceil(count / columns)),
            );
            for (const team of element.querySelectorAll<HTMLElement>(".arena-team")) {
              team.dataset.teamSize = String(count);
              const fighter = team.firstElementChild!;
              for (let i = 1; i < count; i++) team.appendChild(fighter.cloneNode(true));
            }
          }, count);
          const fits = await stage.evaluate((element) => {
            const field = element.getBoundingClientRect();
            const figures = [...element.querySelectorAll(".arena-sprite-window")].map((el) =>
              el.getBoundingClientRect(),
            );
            return figures.every(
              (sprite, i) =>
                sprite.left >= field.left &&
                sprite.right <= field.right &&
                sprite.top >= field.top &&
                sprite.bottom <= field.bottom &&
                figures.every(
                  (other, j) =>
                    i === j ||
                    sprite.right <= other.left ||
                    other.right <= sprite.left ||
                    sprite.bottom <= other.top ||
                    other.bottom <= sprite.top,
                ),
            );
          });
          expect(fits, `${id}: ${count} fighters per side at ${width}px`).toBe(true);
          await stage.evaluate((element) => {
            (element as HTMLElement).style.removeProperty("--formation-rows");
            for (const team of element.querySelectorAll<HTMLElement>(".arena-team")) {
              while (team.children.length > 1) team.lastElementChild!.remove();
              team.dataset.teamSize = "1";
            }
          });
        }
      }
    }
  }
  await page.unroute("**/api/game");
  const after: GameSnapshot = (await (await page.request.get("/api/game")).json()).snapshot;
  expect(after.character).toEqual(original.character);
  expect(after.latestBattle).toBeNull();
  expect(errors).toEqual([]);
});
