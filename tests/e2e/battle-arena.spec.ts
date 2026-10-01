import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { createDatabase } from "../../src/server/db/client";
import * as s from "../../src/server/db/schema";
import { deriveStats } from "../../src/game/attributes";
import { applyExperience } from "../../src/game/progression";
import type { ActionPayload } from "../../src/game/validation";
import type { GameSnapshot } from "../../src/game/types";

const email = `arena-${randomUUID()}@example.test`;
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
async function state(page: Page): Promise<GameSnapshot> {
  const response = await page.request.get("/api/game");
  expect(response.ok()).toBe(true);
  return (await response.json()).snapshot;
}
async function go(page: Page, label: string) {
  const menu = page.getByRole("button", { name: "Abrir menu", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: label, exact: true }).click();
}
async function action(page: Page, origin: string, payload: ActionPayload) {
  const response = await page.request.post("/api/game/actions", {
    headers: { origin },
    data: { ...payload, idempotencyKey: randomUUID() },
  });
  expect(response.ok(), await response.text()).toBe(true);
}

test("arena real: sprites, chute, Ki, replay sem recompensas, cenários e movimento reduzido", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mkdir(".local/screenshots", { recursive: true });
  const signup = await page.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL! },
    data: { email, password: randomUUID() + "Test!", name: "Teste Arena" },
  });
  expect(signup.ok()).toBe(true);
  const created = await page.request.post("/api/game/characters", {
    headers: { origin: baseURL! },
    data: { name: "Guerreiro Arena", raceId: "saiyajin", idempotencyKey: randomUUID() },
  });
  expect(created.ok()).toBe(true);
  const initial = await state(page);
  const progress = applyExperience(1, 0, 100, initial.race.base, initial.race);
  const stats = deriveStats(progress.base, progress.level);
  // Apenas a conta descartável recebe progresso para testar Ki e os cenários.
  await database.db
    .update(s.characters)
    .set({ ...progress, hp: stats.maxHp, ki: stats.maxKi })
    .where(eq(s.characters.id, initial.character.id));
  await action(page, baseURL!, { action: "technique.learn", techniqueId: "rajada-ki" });
  await action(page, baseURL!, { action: "combat.mode", mode: "manual" });
  await page.goto("/jogo");
  await go(page, "Batalhar");
  await page.getByRole("button", { name: /Montanhas/ }).click();
  await page.locator(".enemy-row").getByRole("button", { name: "Batalhar", exact: true }).click();
  const arena = page.locator(".battle-arena");
  const stage = arena.locator(".battle-stage");
  await expect(stage).toHaveAttribute("data-scene", "montanhas");
  await expect(arena.locator(".arena-sprite-sheet")).toHaveCount(2);
  await stage.scrollIntoViewIfNeeded();
  for (const img of await arena.locator(".arena-sprite-sheet, .arena-background").all()) {
    await expect
      .poll(() =>
        img.evaluate(
          (el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
  await expect(arena.locator(".player .arena-sprite-sheet")).toHaveAttribute(
    "src",
    /battle-sprites\/saiyajin-v2/,
  );
  await expect(arena.locator(".enemy .arena-sprite-sheet")).toHaveAttribute(
    "src",
    /battle-sprites\/dinossauro/,
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      await stage.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const figures = Array.from(el.querySelectorAll(".arena-sprite-window")).map((el) =>
          el.getBoundingClientRect(),
        );
        return (
          figures[0].left < figures[1].left &&
          figures.every(
            (f) =>
              f.left >= box.left - 1 &&
              f.right <= box.right + 1 &&
              f.top >= box.top &&
              f.bottom <= box.bottom,
          )
        );
      }),
    ).toBe(true);
    await arena.screenshot({ path: `.local/screenshots/arena-idle-${width}.png` });
  }
  const first = await state(page);
  await arena.getByRole("button", { name: "Usar Chute", exact: true }).click();
  await expect(stage).toHaveAttribute("data-playing", "true");
  await expect(arena.locator(".player .arena-sprite-window")).toHaveAttribute("data-pose", "3");
  await expect(arena.locator(".fx-physical")).toBeAttached();
  await page.waitForTimeout(420); // Conferência visual no instante do impacto.
  await arena.screenshot({ path: ".local/screenshots/arena-kick.png" });
  await expect(stage).toHaveAttribute("data-playing", "false");
  let snapshot = await state(page);
  expect(snapshot.activeBattle!.enemyHp).toBeLessThan(first.activeBattle!.enemyHp);
  await expect(
    arena.getByRole("progressbar", { name: "HP do inimigo", exact: true }),
  ).toHaveAttribute("aria-valuenow", String(snapshot.activeBattle!.enemyHp));
  await expect(arena.getByRole("progressbar", { name: "Seu HP", exact: true })).toHaveAttribute(
    "aria-valuenow",
    String(snapshot.activeBattle!.playerHp),
  );
  await arena.getByRole("button", { name: "Usar Rajada de Ki", exact: true }).click();
  await expect(arena.locator(".fx-from-player.fx-ki")).toBeAttached();
  await expect(arena.locator(".player .arena-sprite-window")).toHaveAttribute("data-pose", "2");
  await page.waitForTimeout(400);
  await arena.screenshot({ path: ".local/screenshots/arena-ki.png" });
  await expect(stage).toHaveAttribute("data-playing", "false");
  snapshot = await state(page);
  await expect(arena.getByRole("progressbar", { name: "Seu Ki", exact: true })).toHaveAttribute(
    "aria-valuenow",
    String(snapshot.activeBattle?.playerKi ?? snapshot.latestBattle!.playerKi),
  );
  if (snapshot.activeBattle) {
    const battleId = snapshot.activeBattle.id;
    const previousEvents = snapshot.activeBattle.events;
    await arena.getByRole("button", { name: "Usar Soco", exact: true }).click();
    await page
      .getByRole("region", { name: "Modo de combate", exact: true })
      .getByRole("button", { name: /Automático/ })
      .click();
    await expect(arena).toHaveAttribute("data-battle-id", battleId);
    await expect(page.getByRole("region", { name: "Combate manual", exact: true })).toHaveCount(0);
    snapshot = await state(page);
    expect(snapshot.latestBattle!.events.slice(0, previousEvents.length)).toEqual(previousEvents);
  }
  await expect(arena.getByRole("button", { name: "Pular animação", exact: true })).toBeVisible();
  await arena.getByRole("button", { name: "Pular animação", exact: true }).click();
  await expect(stage).toHaveAttribute("data-playing", "false");
  const beforeReplay = await state(page);
  let posts = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/game/actions")) posts++;
  });
  await arena.getByRole("button", { name: /Velocidade da animação: 1x/ }).click();
  await arena.getByRole("button", { name: "Rever batalha", exact: true }).click();
  await expect(stage).toHaveAttribute("data-playing", "true");
  await arena.getByRole("button", { name: "Pular animação", exact: true }).click();
  const afterReplay = await state(page);
  expect(posts).toBe(0);
  expect(afterReplay.character).toEqual(beforeReplay.character);
  expect(afterReplay.latestBattle).toEqual(beforeReplay.latestBattle);
  expect(afterReplay.inventory).toEqual(beforeReplay.inventory);

  // Cenários e representantes são apresentados com snapshots da mesma conta.
  // Não troca raça nem distribui recompensas no banco.
  for (const [index, race] of snapshot.catalog.races.entries()) {
    const scenes = ["floresta", "montanhas", "deserto", "red-ribbon", "palacio-daimao"];
    const enemies = ["lobo", "bandido", "saibaman", "soldado-red-ribbon", "piccolo-daimao"];
    const visual: GameSnapshot = structuredClone(beforeReplay);
    visual.character.raceId = race.id;
    visual.race = race;
    visual.latestBattle = {
      ...visual.latestBattle!,
      id: `visual-${race.id}`,
      enemyId: enemies[index],
      areaId: scenes[index],
      events: [
        {
          seq: 0,
          round: 0,
          type: "start",
          player: visual.character.name,
          enemy: visual.catalog.enemies.find((e) => e.id === enemies[index])!.name,
          playerHp: 160,
          enemyHp: 100,
          playerKi: 60,
          enemyKi: 0,
        },
        { seq: 1, round: 1, type: "end", outcome: "victory" },
      ],
    };
    await page.route("**/api/game", (route) => route.fulfill({ json: { snapshot: visual } }));
    await page.reload();
    await go(page, "Batalhar");
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(stage).toHaveAttribute("data-scene", scenes[index]);
    await stage.scrollIntoViewIfNeeded();
    for (const image of await arena.locator(".arena-background, .arena-sprite-sheet").all()) {
      await expect
        .poll(() =>
          image.evaluate(
            (el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0,
          ),
        )
        .toBe(true);
    }
    await expect(arena.locator(".player .arena-sprite-sheet")).toHaveAttribute(
      "src",
      new RegExp(`battle-sprites/${race.id}-v2`),
    );
    await expect
      .poll(() =>
        arena
          .locator(".player .arena-sprite-sheet")
          .evaluate(
            (el) =>
              (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth === 832,
          ),
      )
      .toBe(true);
    await arena.screenshot({ path: `.local/screenshots/arena-${race.id}-${scenes[index]}.png` });
    await page.unroute("**/api/game");
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await database.db
    .update(s.characters)
    .set({ hp: stats.maxHp, ki: stats.maxKi, nextBattleAt: null })
    .where(eq(s.characters.id, initial.character.id));
  await action(page, baseURL!, { action: "combat.mode", mode: "manual" });
  await page.reload();
  await go(page, "Batalhar");
  await page
    .locator(".enemy-row")
    .filter({ hasText: "Bandido" })
    .getByRole("button", { name: "Batalhar", exact: true })
    .click();
  await arena.getByRole("button", { name: "Usar Soco", exact: true }).click();
  await expect(arena.getByText("Rodada 2", { exact: true })).toBeVisible();
  await expect(stage).toHaveAttribute("data-playing", "false");
  await expect(arena.getByText("Movimento reduzido", { exact: true })).toBeVisible();
  await expect(arena.locator(".arena-fx")).toHaveCount(0);
  await expect(arena.getByRole("button", { name: "Usar Soco", exact: true })).toBeEnabled();
  snapshot = await state(page);
  await expect(
    arena.getByRole("progressbar", { name: "HP do inimigo", exact: true }),
  ).toHaveAttribute("aria-valuenow", String(snapshot.activeBattle!.enemyHp));
  expect(errors).toEqual([]);
});
