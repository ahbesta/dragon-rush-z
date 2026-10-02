import { test, expect } from "./browser-test";
import type { Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { createDatabase } from "../../src/server/db/client";
import * as s from "../../src/server/db/schema";
import { buildAttributes, emptyAllocation } from "../../src/game/builds";
import { deriveBuildStats } from "../../src/game/attributes";
import { seedCatalog } from "../../src/server/db/seed-data";
import type { GameSnapshot } from "../../src/game/types";
import { openBattleCommands } from "./turn-menu";

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
async function signup(page: Page, origin: string) {
  const email = `warrior-feedback-${randomUUID()}@example.test`;
  emails.push(email);
  const response = await page.request.post("/api/auth/sign-up/email", {
    headers: { origin },
    data: { email, password: randomUUID() + "Test!", name: "Guerreiro Teste" },
  });
  expect(response.ok()).toBe(true);
  await page.goto("/jogo");
  return email;
}
async function create(page: Page) {
  await page.getByLabel("Nome do guerreiro").fill("Guerreiro");
  await page.getByRole("button", { name: /Começar minha jornada/ }).click();
  await expect(page.getByRole("heading", { name: "Olá, Guerreiro." })).toBeVisible();
}
async function state(page: Page): Promise<GameSnapshot> {
  return (await (await page.request.get("/api/game")).json()).snapshot;
}
async function go(page: Page, label: string) {
  const menu = page.getByRole("button", { name: "Abrir menu", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.locator("#game-navigation").getByRole("button", { name: label, exact: true }).click();
}
async function refresh(page: Page) {
  const updated = page.waitForResponse(
    (response) => response.url().endsWith("/api/game") && response.request().method() === "GET",
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await updated;
}

test("scouter de todas as raças e investimento real de pontos no desktop e celular", async ({
  page,
  baseURL,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mkdir(".local/screenshots", { recursive: true });
  await signup(page, baseURL!);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const race of seedCatalog.races) {
      await page
        .locator(".race-card")
        .filter({ has: page.getByRole("heading", { name: race.name, exact: true }) })
        .click();
      const sheet = page.getByRole("region", { name: "Atributos iniciais da raça" });
      await expect(sheet.locator(".fighter-attribute-card")).toHaveCount(5);
      const expected = deriveBuildStats(buildAttributes(race, emptyAllocation()), 1);
      await expect(sheet.locator(".fighter-power-reading > strong")).toHaveText(
        expected.powerLevel.toLocaleString("pt-BR"),
      );
      await sheet.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await sheet.screenshot({ path: `.local/screenshots/origin-scouter-${race.id}-${width}.png` });
    }
  }
  await page
    .locator(".race-card")
    .filter({ has: page.getByRole("heading", { name: "Saiyajin", exact: true }) })
    .click();
  await create(page);
  const build = page.getByRole("region", { name: "Distribuir atributos" });
  await build.getByRole("button", { name: "Aumentar Força", exact: true }).click();
  await build.getByRole("button", { name: "Aumentar Força", exact: true }).click();
  await build.getByRole("button", { name: "Diminuir Força", exact: true }).click();
  await expect(build.locator(".warrior-point-budget > strong")).toHaveText("4");
  const before = await state(page);
  const expected = deriveBuildStats(
    buildAttributes(before.race, { ...emptyAllocation(), strength: 1 }),
    1,
  );
  await expect(build.locator(".warrior-build-preview")).toContainText(
    expected.powerLevel.toLocaleString("pt-BR"),
  );
  expect(before.character.allocation!.strength).toBe(0);
  await build.getByRole("button", { name: "Confirmar atributos", exact: true }).click();
  await expect.poll(async () => (await state(page)).character.allocation!.strength).toBe(1);
  const sheet = page.getByRole("region", { name: "Atributos do guerreiro" });
  await expect(sheet.locator(".fighter-power-reading > strong")).toHaveText(
    expected.powerLevel.toLocaleString("pt-BR"),
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await build.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await build.screenshot({ path: `.local/screenshots/warrior-build-${width}.png` });
    await sheet.screenshot({ path: `.local/screenshots/warrior-scouter-${width}.png` });
  }
  expect(errors).toEqual([]);
});

for (const width of [390, 1440]) {
  test(`missão concluída após combate e drops, resgate explícito e aviso único em ${width}px`, async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signup(page, baseURL!);
    await create(page);
    const initial = await state(page);
    const allocation = { ...emptyAllocation(), strength: 45, endurance: 5 };
    const base = buildAttributes(initial.race, allocation);
    const stats = deriveBuildStats(base, 10);
    await database.db
      .update(s.characters)
      .set({
        level: 10,
        combatMode: width === 1440 ? "manual" : "automatic",
        allocation,
        base,
        hp: stats.maxHp,
        ki: stats.maxKi,
        questProgress: [{ questId: "floresta", counters: { "0": 1 }, claimed: false }],
      })
      .where(eq(s.characters.id, initial.character.id));
    await page.reload();
    await go(page, "Batalhar");
    await page
      .locator(".enemy-row")
      .filter({ hasText: "Lobo" })
      .getByRole("button", { name: "Batalhar", exact: true })
      .click();
    const modal = page.getByRole("dialog", { name: "Missão cumprida!", exact: true });
    if (width === 1440) {
      const arena = page.locator(".battle-arena");
      await expect(arena).toHaveClass(/manual-battle/);
      await expect(modal).not.toBeVisible();
      for (let turn = 0; turn < 10 && (await state(page)).activeBattle; turn++) {
        await openBattleCommands(arena);
        const result = page.waitForResponse((response) =>
          response.url().endsWith("/api/game/actions"),
        );
        await arena.getByRole("button", { name: "Usar Soco", exact: true }).click();
        const response = await result;
        expect(response.ok()).toBe(true);
        if (!(await response.json()).snapshot.activeBattle) break;
      }
      await expect(arena).toHaveClass(/arena-completed/);
    }
    await expect(page.getByRole("button", { name: "Pular animação", exact: true })).toBeVisible();
    await expect(modal).not.toBeVisible();
    await page.getByRole("button", { name: "Pular animação", exact: true }).click();
    const afterBattle = await state(page);
    if (afterBattle.latestBattle!.drops.length) {
      await expect(page.locator(".arena-loot-reveal")).toBeVisible();
      await expect(modal).not.toBeVisible();
      // A refreshed snapshot must not reset presentation completion or hide a pending reward.
      await refresh(page);
      await page.getByRole("button", { name: "Fechar drops", exact: true }).click();
    }
    await expect(modal).toBeVisible();
    await expect(modal).toContainText("As trilhas de Paozu");
    await expect(modal).toContainText("70 XP");
    expect(afterBattle.character.flags).not.toContain("quest:floresta");
    await modal.screenshot({ path: `.local/screenshots/quest-complete-${width}.png` });
    await modal.getByRole("button", { name: "Ir receber recompensa", exact: true }).click();
    const mission = page.locator('[data-quest-id="floresta"]');
    await expect(mission).toBeFocused();
    await expect(mission).toHaveClass(/reward-ready/);
    expect((await state(page)).character.zeni).toBe(afterBattle.character.zeni);
    await mission.getByRole("button", { name: "Receber recompensa", exact: true }).click();
    await expect
      .poll(async () => (await state(page)).character.flags.includes("quest:floresta"))
      .toBe(true);
    const claimed = await state(page);
    expect(claimed.character.zeni).toBe(afterBattle.character.zeni + 40);
    expect(claimed.character.xp).toBe(afterBattle.character.xp + 70);
    await refresh(page);
    await expect(modal).not.toBeVisible();
    await page.reload();
    await expect(modal).not.toBeVisible();
  });
}

test("treino e descanso avisam fora da tela; concluir valida no servidor, adiar não repete", async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signup(page, baseURL!);
  await create(page);
  for (const kind of ["training", "rest"] as const) {
    const before = await state(page);
    if (kind === "rest") {
      await database.db
        .update(s.characters)
        .set({ hp: 1, ki: 1 })
        .where(eq(s.characters.id, before.character.id));
      await page.reload();
    }
    await go(page, "Treinamento");
    await page
      .getByRole("button", {
        name: kind === "training" ? "Iniciar treinamento" : /^Descansar por/,
        exact: kind === "training",
      })
      .click();
    const pending = await state(page);
    await database.db
      .update(s.activities)
      .set({ finishesAt: new Date(Date.now() + 2500) })
      .where(eq(s.activities.id, pending.activity!.id));
    await refresh(page);
    await go(page, "Inventário");
    const modal = page.getByRole("dialog", {
      name: kind === "training" ? "Treino finalizado!" : "Descanso finalizado!",
      exact: true,
    });
    await expect(modal).toBeVisible();
    const ready = await state(page);
    expect(ready.activity?.id).toBe(pending.activity!.id);
    expect(ready.character.xp).toBe(before.character.xp);
    if (kind === "rest") expect(ready.character.hp).toBe(1);
    await modal.screenshot({ path: `.local/screenshots/activity-complete-${kind}.png` });
    await modal.getByRole("button", { name: /Depois/ }).click();
    await refresh(page);
    await expect(modal).not.toBeVisible();
    // A pending activity survives reload, and its notification remains actionable.
    await page.reload();
    await expect(modal).toBeVisible();
    await modal
      .getByRole("button", {
        name: kind === "training" ? "Concluir treinamento" : "Concluir descanso",
        exact: true,
      })
      .click();
    await expect.poll(async () => (await state(page)).activity).toBeNull();
    await expect(modal).not.toBeVisible();
    const completed = await state(page);
    expect(completed.character.xp).toBe(
      before.character.xp +
        (kind === "training"
          ? before.catalog.policies.find((rule) => rule.id === "training")!.xpReward
          : 0),
    );
    if (kind === "rest") {
      expect(completed.character.hp).toBe(completed.stats.maxHp);
      expect(completed.character.ki).toBe(completed.stats.maxKi);
    }
    await go(page, "Treinamento");
    await refresh(page);
    await expect(modal).not.toBeVisible();
  }
});
