import { test, expect } from "./browser-test";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Page } from "@playwright/test";
import { createDatabase } from "../../src/server/db/client";
import * as s from "../../src/server/db/schema";
import { seedCatalog } from "../../src/server/db/seed-data";
import { createExplorationSession } from "../../src/game/exploration/rules";
import { applyExperience } from "./progress-fixture";
import { deriveBuildStats } from "../../src/game/attributes";
async function go(page: Page, label: string) {
  if (await page.getByRole("button", { name: "Abrir menu", exact: true }).isVisible())
    await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await page.locator("#game-navigation").getByRole("button", { name: label, exact: true }).click();
}
for (const width of [390, 1440])
  test(`exploração: etapas, mochila, recarga, ferramentas e emboscadas em ${width}px`, async ({
    page,
    baseURL,
  }) => {
    const database = createDatabase(process.env.DATABASE_URL!);
    let ownerId: string | undefined;
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await page.setViewportSize({ width, height: 900 });
      const headers = { origin: baseURL! };
      expect(
        (
          await page.request.post("/api/auth/sign-up/email", {
            headers,
            data: {
              email: `exploration-${randomUUID()}@example.test`,
              password: randomUUID() + "X!",
              name: "Teste Exploração",
            },
          })
        ).ok(),
      ).toBe(true);
      expect(
        (
          await page.request.post("/api/game/characters", {
            headers,
            data: { name: "Viajante Paozu", raceId: "saiyajin", idempotencyKey: randomUUID() },
          })
        ).ok(),
      ).toBe(true);
      const state = async () => (await (await page.request.get("/api/game")).json()).snapshot;
      let snapshot = await state();
      const [row] = await database.db
        .select()
        .from(s.characters)
        .where(eq(s.characters.id, snapshot.character.id));
      ownerId = row.userId;
      const progress = applyExperience(1, 0, 200000, snapshot.race.base, snapshot.race);
      const stats = deriveBuildStats(progress.base, progress.level);
      await database.db
        .update(s.characters)
        .set({ ...progress, hp: stats.maxHp, ki: stats.maxKi })
        .where(eq(s.characters.id, row.id));
      snapshot = await state();
      const fixture = async (eventId: string, roll = 0) => {
        await database.db
          .delete(s.explorationSessions)
          .where(eq(s.explorationSessions.characterId, row.id));
        await database.db
          .update(s.characters)
          .set({ nextBattleAt: null, hp: stats.maxHp, ki: stats.maxKi })
          .where(eq(s.characters.id, row.id));
        const event = seedCatalog.explorationEvents.find((e) => e.id === eventId)!;
        const encounter = createExplorationSession(event, randomUUID(), snapshot.stats, () => roll);
        await database.db.insert(s.explorationSessions).values({
          id: encounter.id,
          characterId: row.id,
          state: encounter,
          startedAt: new Date(0),
        });
        await page.reload();
        await expect(page.locator(".exploration-occurrence h2")).toHaveText(event.title);
        return encounter;
      };
      await page.goto("/jogo");
      await go(page, "Explorar");
      await expect(page.locator(".enemy-list")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Procurar um encontro", exact: true }),
      ).toBeEnabled();
      await page.getByRole("button", { name: "Procurar um encontro", exact: true }).click();
      await expect(page.locator(".exploration-occurrence")).toBeVisible();
      expect((await state()).catalog.explorationEvents).toBeUndefined();
      await fixture("floresta-gather");
      await page.getByRole("button", { name: /Recolher o que está perto/ }).click();
      await expect(page.getByLabel("Achados pendentes")).toContainText("Erva medicinal");
      expect((await state()).inventory.some((i: { itemId: string }) => i.itemId === "erva")).toBe(
        false,
      );
      await page.reload();
      await expect(page.locator(".exploration-occurrence")).toContainText("ETAPA 2 DE 2");
      await page
        .locator(".exploration-occurrence")
        .screenshot({ path: `.local/screenshots/exploration-gather-${width}.png` });
      await go(page, "Inventário");
      await expect(page.getByText("Um encontro espera sua decisão")).toBeVisible();
      await page.getByRole("button", { name: "Voltar à exploração" }).click();
      await page.getByRole("button", { name: /Voltar em segurança/ }).click();
      await expect(page.getByLabel("Resultado da exploração")).toContainText("Erva medicinal");
      await expect(page.locator(".arena-loot-reveal")).toBeVisible();
      await page.getByRole("button", { name: "Fechar drops", exact: true }).click();
      expect(
        (await state()).inventory.find((i: { itemId: string }) => i.itemId === "erva").quantity,
      ).toBe(1);
      await fixture("floresta-discovery");
      await page.getByRole("button", { name: /Registrar o caminho/ }).click();
      await expect(page.getByLabel("Resultado da exploração")).toContainText("Caminho descoberto");
      await expect(page.getByRole("option", { name: /Gruta atrás da cachoeira/ })).toBeEnabled();
      await fixture("cidade-oeste-npc");
      await expect(page.locator(".exploration-npc-art")).toBeVisible();
      await expect(page.getByRole("button", { name: /Entregar suprimentos/ })).toBeDisabled();
      await page
        .locator(".exploration-occurrence")
        .screenshot({ path: `.local/screenshots/exploration-bulma-${width}.png` });
      await page.getByRole("button", { name: /Ouvir e seguir viagem/ }).click();
      await fixture("floresta-gather", 0.999);
      await page.getByRole("button", { name: /Recolher o que está perto/ }).click();
      const modeResponse = await page.request.post("/api/game/actions", {
        headers,
        data: { action: "combat.mode", mode: "manual", idempotencyKey: randomUUID() },
      });
      expect(modeResponse.ok()).toBe(true);
      await page.reload();
      await page.getByRole("button", { name: /Buscar mais fundo/ }).click();
      await expect(page.locator(".battle-arena")).toBeVisible();
      await expect(page.locator(".page-heading h1")).toHaveText("Explorar");
      await expect
        .poll(() =>
          page
            .locator(".battle-arena-anchor")
            .evaluate((e) => Math.round(e.getBoundingClientRect().top)),
        )
        .toBe(20);
      await go(page, "Personagem");
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: /Automático O guerreiro luta por você/ }).click();
      await expect(page.locator(".battle-arena")).toHaveClass(/arena-completed/);
      await expect(page.locator(".page-heading h1")).toHaveText("Explorar");
      expect((await state()).activeExploration).toBeNull();
      expect((await state()).latestExploration.battleId).toBe((await state()).latestBattle.id);
      await page.getByRole("button", { name: "Pular animação", exact: true }).click();
      await expect(page.locator(".arena-loot-reveal")).toBeVisible();
      await expect(page.getByLabel("Resultado da exploração")).toContainText("Erva medicinal");
      await page.getByRole("button", { name: "Fechar drops", exact: true }).click();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
      expect(errors).toEqual([]);
    } finally {
      if (ownerId) {
        await database.db.delete(s.user).where(eq(s.user.id, ownerId));
        await database.db.delete(s.rateLimit).where(eq(s.rateLimit.key, `game:${ownerId}`));
      }
      await database.pool.end();
    }
  });

test("catálogo completo: 96 encontros e artes dos 16 destinos sem overflow", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180000);
  const database = createDatabase(process.env.DATABASE_URL!);
  let ownerId: string | undefined;
  try {
    const headers = { origin: baseURL! };
    await page.request.post("/api/auth/sign-up/email", {
      headers,
      data: {
        email: `exploration-art-${randomUUID()}@example.test`,
        password: randomUUID() + "X!",
        name: "Teste Artes",
      },
    });
    await page.request.post("/api/game/characters", {
      headers,
      data: { name: "Viajante Artes", raceId: "humano", idempotencyKey: randomUUID() },
    });
    const snapshot = (await (await page.request.get("/api/game")).json()).snapshot;
    const [row] = await database.db
      .select()
      .from(s.characters)
      .where(eq(s.characters.id, snapshot.character.id));
    ownerId = row.userId;
    let session = createExplorationSession(
      seedCatalog.explorationEvents[0],
      randomUUID(),
      snapshot.stats,
      () => 0,
    );
    await database.db
      .insert(s.explorationSessions)
      .values({ id: session.id, characterId: row.id, state: session });
    await page.goto("/jogo");
    for (const event of seedCatalog.explorationEvents) {
      session = createExplorationSession(event, session.id, snapshot.stats, () => 0);
      await database.db
        .update(s.explorationSessions)
        .set({ state: session })
        .where(eq(s.explorationSessions.id, session.id));
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(page.locator(".exploration-occurrence h2")).toHaveText(event.title);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
      if (event.npcId) {
        await expect
          .poll(() =>
            page
              .locator(".exploration-npc-art")
              .evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0),
          )
          .toBe(true);
        await page
          .locator(".exploration-occurrence")
          .screenshot({ path: `.local/screenshots/exploration-npc-${event.npcId}.png` });
      }
    }
  } finally {
    if (ownerId) {
      await database.db.delete(s.user).where(eq(s.user.id, ownerId));
      await database.db.delete(s.rateLimit).where(eq(s.rateLimit.key, `game:${ownerId}`));
    }
    await database.pool.end();
  }
});
