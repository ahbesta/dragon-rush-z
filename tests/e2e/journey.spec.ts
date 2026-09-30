import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { createDatabase } from "../../src/server/db/client";
import * as s from "../../src/server/db/schema";
import { deriveStats } from "../../src/game/attributes";
import { applyExperience, xpRequired } from "../../src/game/progression";
config({ path: ".env.local", quiet: true });
const email = `journey-${randomUUID()}@example.test`;
const password = randomUUID() + "Test!";
const database = createDatabase(process.env.DATABASE_URL!);
let ownerId: string | undefined;
test.afterAll(async () => {
  try {
    const [owner] = await database.db.select().from(s.user).where(eq(s.user.email, email));
    if (owner) {
      ownerId = owner.id;
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
  await page.getByRole("button", { name: label, exact: true }).click();
}
test("jornada real: conta, raça, treino, nível, técnicas, equipamento e boss", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mkdir(".local/screenshots", { recursive: true });
  await page.goto("/jogo");
  await expect(page).toHaveURL(/\/login/);
  await page.screenshot({ path: ".local/screenshots/login-desktop.png", fullPage: true });
  const unauthorized = await page.request.get("/api/game");
  expect(unauthorized.status()).toBe(401);
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await page.getByLabel("Seu nome", { exact: true }).fill("Rafael Gomes");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Criar minha conta", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Todo poder tem uma/ })).toBeVisible();
  await page.screenshot({ path: ".local/screenshots/character-creation.png", fullPage: true });
  await page.getByLabel("Nome do guerreiro").fill("Rafael");
  await page.getByRole("button", { name: /Começar minha jornada/ }).click();
  await expect(page.getByRole("heading", { name: "Olá, Rafael." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "ESCREVA A SUA LENDA." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir treinamento" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir explorar a terra" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir batalhar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir técnicas" })).toBeVisible();
  await page.screenshot({ path: ".local/screenshots/dashboard-desktop.png", fullPage: true });
  const [owner] = await database.db.select().from(s.user).where(eq(s.user.email, email));
  ownerId = owner.id;
  let state = await (await page.request.get("/api/game")).json();
  expect(state.snapshot.character.level).toBe(1);
  expect(state.snapshot.stats.powerLevel).toBe(185);
  const forged = await page.request.post("/api/game/actions", {
    headers: { origin: baseURL! },
    data: { action: "training.start", xp: 999999, idempotencyKey: randomUUID() },
  });
  expect(forged.status()).toBe(400);
  const invalidOrigin = await page.request.post("/api/game/actions", {
    headers: { origin: "https://evil.example" },
    data: { action: "training.start", idempotencyKey: randomUUID() },
  });
  expect(invalidOrigin.status()).toBe(403);
  await go(page, "Batalhar");
  await page
    .locator(".enemy-row")
    .filter({ hasText: "Lobo" })
    .getByRole("button", { name: "Batalhar", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Vitória!", exact: true })).toBeVisible();
  await expect(page.locator(".battle-adversary img")).toBeVisible();
  state = await (await page.request.get("/api/game")).json();
  expect(state.snapshot.character.xp).toBe(25);
  expect(state.snapshot.character.zeni).toBe(60);
  await go(page, "Personagem");
  await page.getByRole("button", { name: "Treinar agora", exact: true }).click();
  await expect(page.getByText("Treinamento em andamento", { exact: true })).toBeVisible();
  state = await (await page.request.get("/api/game")).json();
  const early = await page.request.post("/api/game/actions", {
    headers: { origin: baseURL! },
    data: {
      action: "activity.finish",
      activityId: state.snapshot.activity.id,
      idempotencyKey: randomUUID(),
    },
  });
  expect(early.status()).toBe(409);
  await page.reload();
  await expect(page.getByText("Treinamento em andamento", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Concluir atividade", exact: true })
    .click({ timeout: 45000 });
  await expect(page.getByRole("status").filter({ hasText: "Treinamento concluído" })).toBeVisible();
  await go(page, "Batalhar");
  await page
    .locator(".enemy-row")
    .filter({ hasText: "Bandido" })
    .getByRole("button", { name: "Batalhar", exact: true })
    .click();
  await expect
    .poll(async () => {
      const data = await (await page.request.get("/api/game")).json();
      return data.snapshot.character.level;
    })
    .toBe(2);
  await go(page, "Técnicas");
  await page.getByRole("button", { name: "Aprender · 30 Zeni", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Rajada de Ki aprendida" }),
  ).toBeVisible();
  await page.screenshot({ path: ".local/screenshots/techniques.png", fullPage: true });
  // Fixture administrativa isolada: evita dezenas de minutos de farm para verificar o boss.
  // Nível 2 e aprendizado acima foram obtidos pelas ações reais do jogo.
  const [race] = await database.db.select().from(s.races).where(eq(s.races.id, "saiyajin"));
  const total = Array.from({ length: 5 }, (_, i) => xpRequired(i + 1)).reduce((a, b) => a + b, 0);
  const progress = applyExperience(1, 0, total, race.base, race);
  const stats = deriveStats(progress.base, progress.level);
  await database.db
    .update(s.characters)
    .set({ ...progress, hp: stats.maxHp, ki: stats.maxKi, nextBattleAt: null })
    .where(eq(s.characters.userId, ownerId!));
  const [character] = await database.db
    .select()
    .from(s.characters)
    .where(eq(s.characters.userId, ownerId!));
  for (const itemId of ["bastao", "armadura-simples", "pocao-hp"])
    await database.db
      .insert(s.inventory)
      .values({ characterId: character.id, itemId, quantity: 1 })
      .onConflictDoNothing();
  await page.reload();
  await go(page, "Inventário");
  await page
    .locator(".inventory-card")
    .filter({ has: page.getByRole("heading", { name: "Bastão", exact: true }) })
    .getByRole("button", { name: "Equipar", exact: true })
    .click();
  await expect(page.getByRole("status").filter({ hasText: "Bastão equipado" })).toBeVisible();
  await page
    .locator(".inventory-card")
    .filter({ has: page.getByRole("heading", { name: "Armadura simples", exact: true }) })
    .getByRole("button", { name: "Equipar", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Armadura simples equipado" }),
  ).toBeVisible();
  await page.screenshot({ path: ".local/screenshots/inventory.png", fullPage: true });
  await go(page, "Batalhar");
  await page.getByRole("button", { name: /Região da Red Ribbon/ }).click();
  await page.locator(".enemy-row").getByRole("button", { name: "Batalhar", exact: true }).click();
  await expect
    .poll(async () => {
      const data = await (await page.request.get("/api/game")).json();
      return data.snapshot.character.flags.includes("defeated:soldado-red-ribbon");
    })
    .toBe(true);
  await go(page, "Inventário");
  await page
    .locator(".inventory-card")
    .filter({ has: page.getByRole("heading", { name: "Poção de HP", exact: true }) })
    .getByRole("button", { name: "Usar item", exact: true })
    .click();
  await expect(page.getByRole("status").filter({ hasText: "Poção de HP utilizado" })).toBeVisible();
  await go(page, "Batalhar");
  await page.getByRole("button", { name: "Enfrentar boss", exact: true }).click();
  await expect
    .poll(async () => {
      const data = await (await page.request.get("/api/game")).json();
      return data.snapshot.latestBattle?.enemyId;
    })
    .toBe("piccolo-daimao");
  state = await (await page.request.get("/api/game")).json();
  expect(state.snapshot.latestBattle.outcome).toBe("victory");
  expect(state.snapshot.latestBattle.events.some((e: { type: string }) => e.type === "phase")).toBe(
    true,
  );
  await page.screenshot({ path: ".local/screenshots/boss-battle.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await go(page, "Personagem");
  await expect(page.getByRole("heading", { name: "Olá, Rafael." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: ".local/screenshots/dashboard-mobile.png", fullPage: true });
  await go(page, "Explorar");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: ".local/screenshots/explore-mobile.png", fullPage: true });
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    if (await page.getByRole("button", { name: "Abrir menu", exact: true }).isVisible())
      await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
    await page.getByRole("button", { name: "Personagem", exact: true }).click();
    await expect(page.getByRole("button", { name: "Treinar agora", exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: `.local/screenshots/lobby-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Abrir técnicas", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Técnicas", exact: true })).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Sair da conta", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar no jogo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Olá, Rafael." })).toBeVisible();
  state = await (await page.request.get("/api/game")).json();
  expect(state.snapshot.character.flags.includes("defeated:piccolo-daimao")).toBe(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Olá, Rafael." })).toBeVisible();
  expect(errors).toEqual([]);
});
