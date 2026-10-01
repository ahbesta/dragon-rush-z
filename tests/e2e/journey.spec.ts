import { test, expect } from "./browser-test";
import { type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { createDatabase } from "../../src/server/db/client";
import * as s from "../../src/server/db/schema";
import type { GameSnapshot } from "../../src/game/types";
import { emptyAllocation } from "../../src/game/builds";

config({ path: ".env.local", quiet: true });
const email = `journey-${randomUUID()}@example.test`;
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
async function go(page: Page, label: string) {
  if (await page.getByRole("button", { name: "Abrir menu", exact: true }).isVisible())
    await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.locator("#game-navigation").getByRole("button", { name: label, exact: true }).click();
}

test("jornada real: conta, build, treino, campanha, vila, boss manual e ranking", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mkdir(".local/screenshots", { recursive: true });
  const origin = { origin: baseURL! };
  const state = async (): Promise<GameSnapshot> =>
    (await (await page.request.get("/api/game")).json()).snapshot;
  const action = async (payload: object) => {
    const response = await page.request.post("/api/game/actions", {
      headers: origin,
      data: { ...payload, idempotencyKey: randomUUID() },
    });
    expect(response.ok(), await response.text()).toBe(true);
  };
  await page.goto("/jogo");
  await expect(page).toHaveURL(/\/login/);
  expect((await page.request.get("/api/game")).status()).toBe(401);
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await page.getByLabel("Seu nome", { exact: true }).fill("Rafael Gomes");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Criar minha conta", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Todo poder tem uma/ })).toBeVisible();
  await page.getByLabel("Nome do guerreiro").fill("Rafael");
  await page.getByRole("button", { name: /Começar minha jornada/ }).click();
  await expect(page.getByRole("heading", { name: "Olá, Rafael." })).toBeVisible();
  let snapshot = await state();
  expect(snapshot.stats.powerLevel).toBe(217);
  const [owner] = await database.db.select().from(s.user).where(eq(s.user.email, email));
  const forged = await page.request.post("/api/game/actions", {
    headers: origin,
    data: { action: "training.start", xp: 999999, idempotencyKey: randomUUID() },
  });
  expect(forged.status()).toBe(400);
  const wrongOrigin = await page.request.post("/api/game/actions", {
    headers: { origin: "https://evil.example" },
    data: { action: "training.start", idempotencyKey: randomUUID() },
  });
  expect(wrongOrigin.status()).toBe(403);
  const build = page.getByRole("region", { name: "Distribuir atributos" });
  for (let i = 0; i < 3; i++)
    await build.getByRole("button", { name: "Aumentar Força", exact: true }).click();
  for (let i = 0; i < 2; i++)
    await build.getByRole("button", { name: "Aumentar Resistência", exact: true }).click();
  await build.getByRole("button", { name: "Confirmar atributos", exact: true }).click();
  await expect.poll(async () => (await state()).character.allocation!.strength).toBe(3);
  snapshot = await state();
  expect(snapshot.stats.strength).toBe(15);
  expect(snapshot.character.hp).toBe(180);
  for (let i = 0; i < 2; i++) {
    await database.db
      .update(s.characters)
      .set({ nextBattleAt: null })
      .where(eq(s.characters.userId, owner.id));
    if (i === 1) await action({ action: "item.use", itemId: "pocao-hp" });
    await action({ action: "battle", areaId: "floresta", enemyId: "lobo" });
  }
  expect((await state()).character.xp).toBe(56);
  await page.reload();
  await go(page, "Missões");
  await page
    .locator(".rpg-quest")
    .filter({ has: page.getByRole("heading", { name: "As trilhas de Paozu", exact: true }) })
    .getByRole("button", { name: "Receber recompensa" })
    .click();
  await expect
    .poll(async () => (await state()).character.flags.includes("quest:floresta"))
    .toBe(true);
  snapshot = await state();
  expect(snapshot.character).toMatchObject({ level: 2, xp: 26, zeni: 116 });
  await go(page, "Treinamento");
  await page.getByRole("button", { name: "Iniciar treinamento", exact: true }).click();
  snapshot = await state();
  const early = await page.request.post("/api/game/actions", {
    headers: origin,
    data: {
      action: "activity.finish",
      activityId: snapshot.activity!.id,
      idempotencyKey: randomUUID(),
    },
  });
  expect(early.status()).toBe(409);
  await page.reload();
  await go(page, "Treinamento");
  await page
    .getByRole("button", { name: "Concluir atividade", exact: true })
    .click({ timeout: 45000 });
  await expect.poll(async () => (await state()).character.xp).toBe(36);
  await action({
    action: "attributes.allocate",
    points: { ...emptyAllocation(), strength: 2, defense: 1, kiControl: 2 },
  });
  await page.reload();
  await go(page, "Vilas e mercado");
  await page
    .locator(".rpg-item-card")
    .filter({ has: page.getByRole("heading", { name: "Bastão", exact: true }) })
    .getByRole("button", { name: /Comprar/ })
    .click();
  await expect
    .poll(async () => (await state()).inventory.some((i) => i.itemId === "bastao"))
    .toBe(true);
  await go(page, "Inventário");
  await page
    .locator(".inventory-card")
    .filter({ has: page.getByRole("heading", { name: "Bastão", exact: true }) })
    .getByRole("button", { name: "Equipar", exact: true })
    .click();
  await expect.poll(async () => (await state()).character.equipment.weapon).toBe("bastao");
  await go(page, "Técnicas");
  await page.getByRole("button", { name: "Aprender · 30 Zeni", exact: true }).click();
  await expect.poll(async () => (await state()).learnedTechniques.includes("rajada-ki")).toBe(true);
  await database.db
    .update(s.characters)
    .set({ nextBattleAt: null })
    .where(eq(s.characters.userId, owner.id));
  await page.reload();
  await go(page, "Missões");
  await page.getByRole("button", { name: "Desafiar Yamcha", exact: true }).click();
  await expect(page.getByRole("region", { name: "Combate manual", exact: true })).toBeVisible();
  await expect(page.locator(".combat-timeline-caption")).toContainText("Yamcha:");
  snapshot = await state();
  expect(snapshot.activeBattle!.manualOnly).toBe(true);
  await page.screenshot({ path: ".local/screenshots/classic-yamcha-desktop.png", fullPage: true });
  for (let turn = 0; turn < 50 && (await state()).activeBattle; turn++) {
    const b = (await state()).activeBattle!;
    const stats = (await state()).stats;
    const heal = b.consumables!.find((i) => i.itemId === "pocao-hp" && i.available);
    if (b.playerHp < stats.maxHp * 0.65 && heal)
      await action({
        action: "battle.action",
        battleId: b.id,
        round: b.round,
        command: { kind: "item", itemId: heal.itemId },
      });
    else if (b.intent?.kind === "attack" && (b.intent.multiplier ?? 1) > 1.2)
      await action({
        action: "battle.action",
        battleId: b.id,
        round: b.round,
        command: { kind: "guard" },
      });
    else
      await action({
        action: "battle.turn",
        battleId: b.id,
        round: b.round,
        techniqueId: b.techniques.find((t) => t.available && t.id !== "soco")?.id ?? "soco",
      });
  }
  snapshot = await state();
  expect(snapshot.latestBattle!.outcome).toBe("victory");
  expect(snapshot.latestBattle!.drops).toContainEqual({ itemId: "trofeu-yamcha", quantity: 1 });
  expect(snapshot.latestBattle!.usedItems!.length).toBeGreaterThan(0);
  await page.reload();
  await go(page, "Missões");
  await page
    .locator(".rpg-quest")
    .filter({ has: page.getByRole("heading", { name: "O bandido do deserto", exact: true }) })
    .getByRole("button", { name: "Receber recompensa" })
    .click();
  await expect
    .poll(async () => (await state()).character.flags.includes("quest:yamcha"))
    .toBe(true);
  await go(page, "Ranking");
  await expect(
    page.getByRole("heading", { name: "Ranking de Power Level", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Sua posição:", { exact: false })).toBeVisible();
  const ranking = await (await page.request.get("/api/game/ranking")).json();
  expect(ranking.own.name).toBe("Rafael");
  expect(JSON.stringify(ranking)).not.toContain(email);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await go(page, "Personagem");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `.local/screenshots/classic-lobby-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Mapa: Mercado", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Vilas e serviços", exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await go(page, "Sair da conta");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar no jogo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Olá, Rafael." })).toBeVisible();
  await page.reload();
  expect((await state()).character.flags).toContain("quest:yamcha");
  expect(errors).toEqual([]);
});
