import { test, expect } from "./browser-test";
import { openBattleCommands } from "./turn-menu";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { createDatabase } from "../../src/server/db/client";
import * as s from "../../src/server/db/schema";
import { buildAttributes, emptyAllocation } from "../../src/game/builds";
import { deriveBuildStats } from "../../src/game/attributes";
import type { GameSnapshot } from "../../src/game/types";
import type { ActionPayload } from "../../src/game/validation";

const email = `turn-menu-${randomUUID()}@example.test`;
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

test("menu Dragon Ball dentro da arena, bolsa e defesa, velocidade persistente e farm de boss", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180000);
  await mkdir(".local/screenshots", { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const state = async (): Promise<GameSnapshot> =>
    (await (await page.request.get("/api/game")).json()).snapshot;
  const action = async (payload: ActionPayload) => {
    const response = await page.request.post("/api/game/actions", {
      headers: { origin: baseURL! },
      data: { ...payload, idempotencyKey: randomUUID() },
    });
    expect(response.ok(), await response.text()).toBe(true);
  };
  const go = async (name: string) => {
    const toggle = page.getByRole("button", { name: "Abrir menu", exact: true });
    if (await toggle.isVisible()) await toggle.click();
    await page.locator("#game-navigation").getByRole("button", { name, exact: true }).click();
  };
  const signup = await page.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL! },
    data: { email, password: randomUUID() + "Test!", name: "Teste Menu" },
  });
  expect(signup.ok(), await signup.text()).toBe(true);
  const created = await page.request.post("/api/game/characters", {
    headers: { origin: baseURL! },
    data: { name: "Guerreiro Z", raceId: "saiyajin", idempotencyKey: randomUUID() },
  });
  expect(created.ok()).toBe(true);
  const initial = await state();
  const allocation = { ...emptyAllocation(), strength: 65, defense: 55 };
  const base = buildAttributes(initial.race, allocation);
  const stats = deriveBuildStats(base, 25);
  await database.db
    .update(s.characters)
    .set({
      level: 25,
      allocation,
      base,
      hp: stats.maxHp - 50,
      ki: stats.maxKi - 50,
      flags: ["quest:floresta"],
    })
    .where(eq(s.characters.id, initial.character.id));
  await action({ action: "combat.mode", mode: "manual" });
  await action({ action: "battle", areaId: "floresta", enemyId: "bandido" });
  await page.goto("/jogo");
  await go("Batalhar");
  const arena = page.locator(".battle-arena");
  const stage = arena.locator(".battle-stage");
  await expect(arena.locator(".arena-commands")).toHaveCount(0);
  await expect(stage.locator(".arena-turn-menu")).toHaveCount(0);
  await expect(arena.locator(".arena-hud-versus")).toHaveCount(0);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    const menu = await openBattleCommands(arena);
    await expect(menu.locator(".command-dragon-ball")).toHaveCount(1);
    await expect(menu.getByRole("button", { name: /^Defender/ })).toBeEnabled();
    expect(
      await arena.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const field = el.querySelector(".battle-stage")!.getBoundingClientRect();
        const panel = el.querySelector(".turn-menu-panel")!.getBoundingClientRect();
        return (
          panel.left >= box.left &&
          panel.right <= box.right &&
          panel.top >= field.bottom &&
          panel.bottom <= box.bottom
        );
      }),
    ).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    for (const image of await menu.locator("img").all())
      await expect
        .poll(() =>
          image.evaluate(
            (el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0,
          ),
        )
        .toBe(true);
    await arena.screenshot({ path: `.local/screenshots/dragon-turn-menu-${width}.png` });
    // Visual-only formations validate the reserved team lanes; no game state is changed.
    for (const count of [2, 3, 5]) {
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
      expect(
        await stage.evaluate((element) => {
          const field = element.getBoundingClientRect();
          const figures = Array.from(element.querySelectorAll(".arena-sprite-window")).map(
            (sprite) => sprite.getBoundingClientRect(),
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
        }),
      ).toBe(true);
      await stage.evaluate((element) => {
        (element as HTMLElement).style.removeProperty("--formation-rows");
        for (const team of element.querySelectorAll<HTMLElement>(".arena-team")) {
          while (team.children.length > 1) team.lastElementChild!.remove();
          team.dataset.teamSize = "1";
        }
      });
    }
  }
  // A pending fight always resumes on the arena and blocks every menu destination.
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    for (const destination of ["Treinamento", "Inventário", "Explorar", "Sair da conta"]) {
      const previous = await state();
      await go(destination);
      const notice = page.getByRole("dialog", { name: "O combate ainda não acabou!" });
      await expect(notice).toBeVisible();
      await expect(notice).toContainText(destination);
      expect(
        await notice.evaluate((element) => {
          const box = element.getBoundingClientRect();
          return (
            Math.abs(box.left + box.width / 2 - innerWidth / 2) < 2 &&
            Math.abs(box.top + box.height / 2 - innerHeight / 2) < 2
          );
        }),
      ).toBe(true);
      await expect(page.locator(".page-heading h1")).toHaveText("Batalhar");
      expect((await state()).activeBattle).toEqual(previous.activeBattle);
      await page.screenshot({ path: `.local/screenshots/battle-navigation-lock-${width}.png` });
      await notice.getByRole("button", { name: "Voltar ao combate", exact: true }).click();
      await expect(notice).toHaveCount(0);
    }
    const toggle = page.getByRole("button", { name: "Abrir menu", exact: true });
    if (await toggle.isVisible()) await toggle.click();
    await page.getByRole("link", { name: "Perfil", exact: true }).click();
    const notice = page.getByRole("dialog", { name: "O combate ainda não acabou!" });
    await expect(notice).toContainText("Perfil");
    await page.keyboard.press("Escape");
    await expect(notice).toHaveCount(0);
    await expect(page).toHaveURL(/\/jogo/);
  }
  const timeline = arena.getByRole("complementary", { name: "Linha de turnos", exact: true });
  await expect(timeline.locator(".combat-turn")).toHaveCount(2);
  const firstActor = (await state()).activeBattle!.initiative!;
  await expect(timeline.locator(".combat-turn").first().locator(".combat-avatar")).toHaveClass(
    new RegExp(`avatar-${firstActor}`),
  );
  const playerAvatar = timeline.getByRole("button", {
    name: "Destacar Guerreiro Z na arena",
    exact: true,
  });
  await playerAvatar.hover();
  await expect(stage.locator(".arena-fighter.player")).toHaveAttribute("data-highlight", "true");
  await expect(stage.locator(".arena-fighter.enemy")).toHaveAttribute("data-highlight", "false");
  await timeline.getByRole("button", { name: "Destacar Bandido na arena", exact: true }).focus();
  await expect(stage.locator(".arena-fighter.enemy")).toHaveAttribute("data-highlight", "true");
  await stage.locator(".arena-background").hover({ position: { x: 3, y: 3 } });
  await timeline.getByRole("button", { name: "Abrir histórico de turnos", exact: true }).click();
  await expect(timeline.locator(".combat-timeline-history")).toContainText(
    "O combate está começando",
  );
  await timeline.getByRole("button", { name: "Fechar histórico de turnos", exact: true }).click();
  const techniques = await openBattleCommands(arena, "Técnicas");
  await expect(techniques.getByRole("button", { name: "Usar Soco", exact: true })).toHaveCount(0);
  await expect(techniques.getByRole("button", { name: "Usar Chute", exact: true })).toBeVisible();
  await techniques.getByRole("button", { name: "Fechar comandos", exact: true }).click();
  let menu = await openBattleCommands(arena);
  await menu.getByRole("button", { name: /^Defender/ }).click();
  await expect.poll(async () => (await state()).activeBattle?.round).toBe(2);
  menu = await openBattleCommands(arena);
  await menu.getByRole("button", { name: /^Concentrar/ }).click();
  await expect.poll(async () => (await state()).activeBattle?.round).toBe(3);
  const beforeItem = await state();
  menu = await openBattleCommands(arena, "Itens");
  await expect(menu).toContainText("Usar um item consome sua ação.");
  await menu.getByRole("button", { name: "Usar Poção de HP", exact: true }).click();
  await expect.poll(async () => (await state()).activeBattle?.itemUses).toBe(1);
  const afterItem = await state();
  await expect(arena.locator(".arena-battle-journal .combat-avatar")).not.toHaveCount(0);
  await arena
    .locator(".arena-battle-journal")
    .getByRole("button", { name: "Destacar Guerreiro Z na arena", exact: true })
    .first()
    .hover();
  await expect(stage.locator(".arena-fighter.player")).toHaveAttribute("data-highlight", "true");
  expect(afterItem.inventory.find((i) => i.itemId === "pocao-hp")!.quantity).toBe(
    beforeItem.inventory.find((i) => i.itemId === "pocao-hp")!.quantity - 1,
  );
  menu = await openBattleCommands(arena, "Itens");
  await expect(menu.getByRole("button", { name: "Usar Poção de HP", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(menu.getByRole("button", { name: "Técnicas", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeVisible();
  await openBattleCommands(arena);
  await arena.getByRole("button", { name: "Usar Soco", exact: true }).click();
  await expect.poll(async () => (await state()).activeBattle).toBeNull();
  await arena.getByRole("button", { name: "Velocidade da animação: 1x", exact: true }).click();
  await expect(
    arena.getByRole("button", { name: "Velocidade da animação: 2x", exact: true }),
  ).toBeVisible();
  await page.reload();
  await go("Batalhar");
  await expect(
    arena.getByRole("button", { name: "Velocidade da animação: 2x", exact: true }),
  ).toBeVisible();
  await arena.getByRole("button", { name: "Velocidade da animação: 2x", exact: true }).click();
  await page.reload();
  await go("Batalhar");
  await expect(
    arena.getByRole("button", { name: "Velocidade da animação: 3x", exact: true }),
  ).toBeVisible();
  await database.db
    .update(s.characters)
    .set({ hp: stats.maxHp, ki: stats.maxKi, nextBattleAt: null })
    .where(eq(s.characters.id, initial.character.id));
  await action({ action: "combat.mode", mode: "automatic" });
  await action({ action: "boss", enemyId: "yamcha" });
  const first = await state();
  expect(first.activeBattle?.manualOnly).toBe(true);
  await action({ action: "combat.mode", mode: "automatic" });
  expect((await state()).activeBattle?.id).toBe(first.activeBattle!.id);
  await page.reload();
  await go("Batalhar");
  await expect(
    arena.getByRole("button", { name: "Velocidade da animação: 3x", exact: true }),
  ).toBeVisible();
  for (let round = 0; (await state()).activeBattle && round < 15; round++) {
    await openBattleCommands(arena);
    await arena.getByRole("button", { name: "Usar Soco", exact: true }).click();
    await expect
      .poll(async () => (await state()).activeBattle?.round ?? 99)
      .toBeGreaterThan(round + 1);
  }
  const cleared = await state();
  expect(cleared.latestBattle?.outcome).toBe("victory");
  expect(cleared.character.flags).toContain("defeated:yamcha");
  await database.db
    .update(s.characters)
    .set({ hp: stats.maxHp, nextBattleAt: null })
    .where(eq(s.characters.id, initial.character.id));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const boss = page.locator(".enemy-row").filter({ hasText: "Yamcha" });
  await boss.getByRole("button", { name: "Desafiar · automático", exact: true }).click();
  await expect
    .poll(async () => (await state()).latestBattle?.id)
    .not.toBe(cleared.latestBattle!.id);
  const farm = await state();
  expect(farm.activeBattle).toBeNull();
  expect(farm.latestBattle).toMatchObject({ enemyId: "yamcha", outcome: "victory" });
  await expect(
    arena.getByRole("button", { name: "Velocidade da animação: 3x", exact: true }),
  ).toBeVisible();
  // Presentation-only fixtures exercise every classic sprite without changing server progress.
  const classics = farm.catalog.enemies.filter(
    (enemy) =>
      !enemy.heroicOf &&
      enemy.artId &&
      ![
        "lobo",
        "bandido",
        "dinossauro",
        "saibaman",
        "soldado-red-ribbon",
        "piccolo-daimao",
        "fera-planicies",
      ].includes(enemy.id),
  );
  for (const enemy of classics) {
    const visual = structuredClone(farm);
    visual.latestBattle = {
      ...farm.latestBattle!,
      id: `art-${enemy.id}`,
      enemyId: enemy.id,
      areaId: farm.catalog.encounters.find((encounter) => encounter.enemyId === enemy.id)?.areaId,
      drops: [],
      events: [
        {
          seq: 0,
          type: "start",
          round: 0,
          player: farm.character.name,
          enemy: enemy.name,
          playerHp: farm.stats.maxHp,
          enemyHp: enemy.maxHp,
          playerKi: farm.stats.maxKi,
          enemyKi: enemy.maxKi,
        },
        { seq: 1, type: "end", round: 1, outcome: "victory" },
      ],
    };
    await page.route("**/api/game", (route) => route.fulfill({ json: { snapshot: visual } }));
    await page.reload();
    await go("Batalhar");
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    const image = arena.locator(".enemy .arena-sprite-sheet");
    await expect(image).toHaveAttribute("src", new RegExp(`classic/${enemy.id}-v2.webp`));
    await expect
      .poll(() =>
        image.evaluate(
          (el) =>
            (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth === 384,
        ),
      )
      .toBe(true);
    expect(
      await image.evaluate((el) => {
        const image = el as HTMLImageElement;
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let y = 0; y < canvas.height; y++)
          for (let x = 0; x < canvas.width; x++) {
            if (
              (x < 16 || x >= canvas.width - 16 || y < 24 || y >= canvas.height - 24) &&
              pixels[(y * canvas.width + x) * 4 + 3] > 8
            )
              return false;
          }
        return true;
      }),
    ).toBe(true);
    if (["prova-kame", "tenshinhan", "major-metallic", "general-blue"].includes(enemy.id)) {
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 1100 });
        await arena.screenshot({ path: `.local/screenshots/fighter-${enemy.id}-${width}.png` });
      }
    }
    await page.unroute("**/api/game");
  }
  expect(classics.length).toBe(23);
  expect(errors).toEqual([]);
});
