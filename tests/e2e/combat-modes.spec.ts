import { test, expect } from "./browser-test";
import { type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { createDatabase } from "../../src/server/db/client";
import * as s from "../../src/server/db/schema";
import { deriveBuildStats as deriveStats } from "../../src/game/attributes";
import { applyExperience } from "./progress-fixture";
import type { GameSnapshot } from "../../src/game/types";
const email = `combat-modes-${randomUUID()}@example.test`;
const password = randomUUID() + "Test!";
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
async function state(page: Page): Promise<GameSnapshot> {
  const response = await page.request.get("/api/game");
  expect(response.ok()).toBe(true);
  return (await response.json()).snapshot;
}
async function go(page: Page, name: string) {
  const menu = page.getByRole("button", { name: "Abrir menu", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name, exact: true }).click();
}
test("automático, manual, retomada, troca durante combate e celular", async ({ page, baseURL }) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mkdir(".local/screenshots", { recursive: true });
  const origin = { origin: baseURL! };
  const created = await page.request.post("/api/auth/sign-up/email", {
    headers: origin,
    data: { email, password, name: "Teste Combate" },
  });
  expect(created.ok()).toBe(true);
  const character = await page.request.post("/api/game/characters", {
    headers: origin,
    data: { name: "Lutador", raceId: "saiyajin", idempotencyKey: randomUUID() },
  });
  expect(character.ok(), await character.text()).toBe(true);
  await page.goto("/jogo");
  const selector = page.getByRole("region", { name: "Modo de combate", exact: true });
  const automatic = selector.getByRole("button", { name: /Automático/ });
  const manual = selector.getByRole("button", { name: /Manual/ });
  await expect(automatic).toHaveAttribute("aria-pressed", "true");
  await manual.click();
  await expect(manual).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(manual).toHaveAttribute("aria-pressed", "true");
  await go(page, "Batalhar");
  await page
    .locator(".enemy-row")
    .filter({ hasText: "Bandido" })
    .getByRole("button", { name: "Batalhar", exact: true })
    .click();
  const battle = page.getByRole("region", { name: "Combate manual", exact: true });
  await expect(battle).toBeVisible();
  await expect(battle.getByText("Rodada 1", { exact: true })).toBeVisible();
  const initial = await state(page);
  expect(initial.character).toMatchObject({ xp: 0, zeni: 50 });
  expect(initial.latestBattle).toBeNull();
  await battle.getByRole("button", { name: "Usar Chute", exact: true }).click();
  await expect(battle.getByText("Rodada 2", { exact: true })).toBeVisible();
  await expect(battle.getByRole("button", { name: "Usar Chute", exact: true })).toBeDisabled();
  await expect(battle.getByText("Recarga: 1 rodada(s)")).toBeVisible();
  const second = await state(page);
  expect(second.activeBattle?.playerHp).toBeLessThan(initial.activeBattle!.playerHp);
  expect(second.activeBattle?.enemyHp).toBeLessThan(initial.activeBattle!.enemyHp);
  expect(second.character.xp).toBe(0);
  await page.screenshot({ path: ".local/screenshots/manual-combat-desktop.png", fullPage: true });
  await page.reload();
  await expect(battle.getByText("Rodada 2", { exact: true })).toBeVisible();
  expect((await state(page)).activeBattle).toEqual(second.activeBattle);
  await go(page, "Treinamento");
  await expect(page.getByRole("button", { name: /Iniciar treinamento/ })).toBeDisabled();
  await expect(battle).toBeVisible();
  const forged = await page.request.post("/api/game/actions", {
    headers: origin,
    data: {
      action: "battle.turn",
      battleId: second.activeBattle!.id,
      round: 2,
      techniqueId: "soco",
      damage: 999999,
      idempotencyKey: randomUUID(),
    },
  });
  expect(forged.status()).toBe(400);
  const stale = await page.request.post("/api/game/actions", {
    headers: origin,
    data: {
      action: "battle.turn",
      battleId: second.activeBattle!.id,
      round: 1,
      techniqueId: "soco",
      idempotencyKey: randomUUID(),
    },
  });
  expect(stale.status()).toBe(409);
  await battle.getByRole("button", { name: "Usar Soco", exact: true }).click();
  await expect(battle.getByText("Rodada 3", { exact: true })).toBeVisible();
  await expect(battle.getByRole("button", { name: "Usar Chute", exact: true })).toBeEnabled();
  const beforeAuto = await state(page);
  await automatic.click();
  await expect(page.getByRole("heading", { name: "Vitória!", exact: true })).toBeVisible();
  await expect(battle).toHaveCount(0);
  let snapshot = await state(page);
  expect(snapshot.activeBattle).toBeNull();
  expect(snapshot.character).toMatchObject({ combatMode: "automatic", xp: 36, zeni: 66 });
  expect(snapshot.latestBattle?.id).toBe(initial.activeBattle!.id);
  expect(snapshot.latestBattle?.events.slice(0, beforeAuto.activeBattle!.events.length)).toEqual(
    beforeAuto.activeBattle!.events,
  );

  // Fixture isolada para validar Ki, técnicas e bosses sem longas sessões de farm.
  const race = snapshot.race;
  const progress = applyExperience(1, 0, 100, race.base, race);
  const stats = deriveStats(progress.base, progress.level);
  await database.db
    .update(s.characters)
    .set({ ...progress, hp: stats.maxHp, ki: 15, nextBattleAt: null })
    .where(eq(s.characters.id, snapshot.character.id));
  await page.reload();
  const learned = await page.request.post("/api/game/actions", {
    headers: origin,
    data: { action: "technique.learn", techniqueId: "rajada-ki", idempotencyKey: randomUUID() },
  });
  expect(learned.ok()).toBe(true);
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });
  await manual.click();
  await expect(manual).toHaveAttribute("aria-pressed", "true");
  await go(page, "Batalhar");
  await page.getByRole("button", { name: "Trocar área", exact: true }).click();
  await page.getByRole("button", { name: /Montanhas/ }).click();
  await page.locator(".enemy-row").getByRole("button", { name: "Batalhar", exact: true }).click();
  await expect(battle).toBeVisible();
  await battle.getByRole("button", { name: "Usar Rajada de Ki", exact: true }).click();
  await expect(battle.getByText("Rodada 2", { exact: true })).toBeVisible();
  expect((await state(page)).activeBattle?.playerKi).toBe(0);
  await expect(
    battle.getByRole("button", { name: "Usar Rajada de Ki", exact: true }),
  ).toBeDisabled();
  await battle.getByRole("button", { name: "Usar Soco", exact: true }).click();
  await expect(battle.getByText("Rodada 3", { exact: true })).toBeVisible();
  await expect(battle.getByText("Ki insuficiente", { exact: true })).toBeVisible();
  await page.screenshot({ path: ".local/screenshots/manual-combat-mobile.png", fullPage: true });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  for (let turns = 0; turns < 10 && (await state(page)).activeBattle; turns++) {
    const current = (await state(page)).activeBattle!;
    await battle.getByRole("button", { name: "Usar Soco", exact: true }).click();
    await expect
      .poll(async () => (await state(page)).activeBattle?.round ?? 99)
      .toBeGreaterThan(current.round);
  }
  snapshot = await state(page);
  expect(snapshot.activeBattle).toBeNull();
  expect(snapshot.latestBattle?.outcome).toBe("victory");
  expect(snapshot.character.combatMode).toBe("manual");
  await go(page, "Explorar");
  await database.db
    .update(s.characters)
    .set({ nextBattleAt: null })
    .where(eq(s.characters.id, snapshot.character.id));
  await page.reload();
  await go(page, "Explorar");
  await page.getByRole("button", { name: "Explorar e batalhar", exact: true }).click();
  await expect(battle).toBeVisible();
  await automatic.click();
  await expect(battle).toHaveCount(0);
  snapshot = await state(page);
  const bossProgress = applyExperience(1, 0, 30000, race.base, race);
  const bossStats = deriveStats(bossProgress.base, bossProgress.level);
  await database.db
    .update(s.characters)
    .set({
      ...bossProgress,
      hp: bossStats.maxHp,
      ki: bossStats.maxKi,
      nextBattleAt: null,
      flags: ["quest:drum", "quest:tambourine"],
    })
    .where(eq(s.characters.id, snapshot.character.id));
  await page.reload();
  await manual.click();
  await expect(manual).toHaveAttribute("aria-pressed", "true");
  await go(page, "Batalhar");
  await page.getByRole("button", { name: "Trocar área", exact: true }).click();
  await page.getByRole("button", { name: /Castelo do Rei/ }).click();
  await page
    .locator(".enemy-row")
    .filter({ hasText: "Piccolo Daimao" })
    .getByRole("button", { name: "Desafiar · manual", exact: true })
    .click();
  await expect(battle.getByRole("heading", { name: "Lutador vs Piccolo Daimao" })).toBeVisible();
  expect((await state(page)).activeBattle?.enemyMaxHp).toBe(832);
  await automatic.click();
  await expect(battle).toBeVisible();
  expect((await state(page)).activeBattle?.manualOnly).toBe(true);
  for (let turns = 0; turns < 40 && (await state(page)).activeBattle; turns++) {
    const b = (await state(page)).activeBattle!;
    const response = await page.request.post("/api/game/actions", {
      headers: origin,
      data: {
        action: "battle.turn",
        battleId: b.id,
        round: b.round,
        techniqueId: b.techniques.find((t) => t.available)?.id ?? "soco",
        idempotencyKey: randomUUID(),
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
  }
  await page.reload();
  await go(page, "Batalhar");
  await expect(battle).toHaveCount(0);
  const completed = await state(page);
  expect(completed.latestBattle?.enemyId).toBe("piccolo-daimao");
  // Reaching a boss phase depends on damage and survival; every outcome must finish and keep the mode.
  expect(completed.activeBattle).toBeNull();
  expect(completed.latestBattle?.events.at(-1)).toMatchObject({
    type: "end",
    outcome: completed.latestBattle?.outcome,
  });
  await manual.click();
  await expect(manual).toHaveAttribute("aria-pressed", "true");
  await go(page, "Personagem");
  await go(page, "Sair da conta");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar no jogo", exact: true }).click();
  await expect(manual).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});
