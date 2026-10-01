import { test, expect } from "./browser-test";
import { type Locator, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createDatabase } from "../../src/server/db/client";
import * as s from "../../src/server/db/schema";
import { applyExperience } from "./progress-fixture";
import { deriveBuildStats as deriveStats } from "../../src/game/attributes";

const emails: string[] = [];
const database = createDatabase(process.env.DATABASE_URL!);

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

async function go(page: Page, label: string) {
  const menu = page.getByRole("button", { name: "Abrir menu", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.locator("#game-navigation").getByRole("button", { name: label, exact: true }).click();
}

async function clickWithoutScrollReset(
  page: Page,
  button: Locator,
  completed: () => Promise<void>,
) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  // Keep the real server request pending until the click's own scrolling has ended.
  await page.route("**/api/game/actions", async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await button.click();
    const before = await page.evaluate(() => {
      const target = window as typeof window & {
        battleScrollResets: number;
        originalScrollTo: typeof window.scrollTo;
      };
      target.battleScrollResets = 0;
      target.originalScrollTo = window.scrollTo;
      window.scrollTo = ((...args: Parameters<typeof window.scrollTo>) => {
        target.battleScrollResets++;
        target.originalScrollTo.apply(window, args);
      }) as typeof window.scrollTo;
      return window.scrollY;
    });
    expect(before).toBeGreaterThan(100);
    release();
    await completed();
    expect(
      await page.evaluate(
        () => (window as typeof window & { battleScrollResets: number }).battleScrollResets,
      ),
    ).toBe(0);
    // Allow natural anchoring when the server message changes the layout above the fight.
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThan(120);
  } finally {
    release();
    await page.unroute("**/api/game/actions");
    await page.evaluate(() => {
      const target = window as typeof window & { originalScrollTo?: typeof window.scrollTo };
      if (target.originalScrollTo) window.scrollTo = target.originalScrollTo;
    });
  }
}

for (const section of ["Batalhar", "Explorar"]) {
  for (const width of [390, 1440]) {
    test(`${section}: início vai à arena e conclusão preserva seção e scroll em ${width}px`, async ({
      page,
      baseURL,
    }) => {
      const email = `battle-scroll-${randomUUID()}@example.test`;
      emails.push(email);
      await page.setViewportSize({ width, height: 700 });
      const signup = await page.request.post("/api/auth/sign-up/email", {
        headers: { origin: baseURL! },
        data: { email, password: randomUUID() + "Test!", name: "Teste Rolagem" },
      });
      expect(signup.ok()).toBe(true);
      const created = await page.request.post("/api/game/characters", {
        headers: { origin: baseURL! },
        data: { name: "Guerreiro Scroll", raceId: "saiyajin", idempotencyKey: randomUUID() },
      });
      expect(created.ok()).toBe(true);
      const initial = (await (await page.request.get("/api/game")).json()).snapshot;
      // Only the disposable test character gets enough real progression to win in one hit.
      const progress = applyExperience(1, 0, 10000, initial.race.base, initial.race);
      const stats = deriveStats(progress.base, progress.level);
      await database.db
        .update(s.characters)
        .set({ ...progress, hp: stats.maxHp, ki: stats.maxKi })
        .where(eq(s.characters.id, initial.character.id));
      async function action(payload: Record<string, string>) {
        const response = await page.request.post("/api/game/actions", {
          headers: { origin: baseURL! },
          data: { ...payload, idempotencyKey: randomUUID() },
        });
        expect(response.ok(), await response.text()).toBe(true);
      }
      await action({ action: "combat.mode", mode: "manual" });
      await page.goto("/jogo");
      await go(page, section);
      const startFight = () =>
        section === "Explorar"
          ? page.getByRole("button", { name: "Explorar e batalhar", exact: true })
          : page
              .locator(".enemy-row")
              .filter({ hasText: "Lobo" })
              .getByRole("button", { name: "Batalhar", exact: true });
      await startFight().click();
      const arena = page.locator(".battle-arena");
      await expect(arena).toHaveClass(/manual-battle/);
      await expect(page.locator(".page-heading h1")).toHaveText(section);
      await expect
        .poll(() =>
          page
            .locator(".battle-arena-anchor")
            .evaluate((el) => Math.round(el.getBoundingClientRect().top)),
        )
        .toBe(20);
      // Exploration rolls the enemy and evasion; finish the real fight without assuming one hit.
      for (let turn = 0; turn < 12; turn++) {
        const current = (await (await page.request.get("/api/game")).json()).snapshot;
        if (!current.activeBattle) break;
        await clickWithoutScrollReset(
          page,
          arena.getByRole("button", { name: "Usar Soco", exact: true }),
          async () => {
            await expect
              .poll(
                async () =>
                  (await (await page.request.get("/api/game")).json()).snapshot.activeBattle
                    ?.round ?? 99,
              )
              .toBeGreaterThan(current.activeBattle.round);
            await expect(page.locator(".page-heading h1")).toHaveText(section);
          },
        );
      }
      await expect(arena).toHaveClass(/arena-completed/);
      if (await arena.getByRole("button", { name: "Pular animação", exact: true }).isVisible()) {
        await arena.getByRole("button", { name: "Pular animação", exact: true }).click();
      }
      const dismissDrops = arena.getByRole("button", { name: "Fechar drops", exact: true });
      if (await dismissDrops.isVisible()) await dismissDrops.click();
      await expect(arena.locator(".arena-outcome")).toBeVisible();

      await database.db
        .update(s.characters)
        .set({ nextBattleAt: null })
        .where(eq(s.characters.id, initial.character.id));
      await action({ action: "combat.mode", mode: "automatic" });
      await page.reload();
      await go(page, section);
      const previousId = await arena.getAttribute("data-battle-id");
      await startFight().click();
      await expect(arena).not.toHaveAttribute("data-battle-id", previousId!);
      await expect(arena).toHaveClass(/arena-completed/);
      await expect
        .poll(() =>
          page
            .locator(".battle-arena-anchor")
            .evaluate((el) => Math.round(el.getBoundingClientRect().top)),
        )
        .toBe(20);
      await expect(page.locator(".battle-arena-anchor")).toBeFocused();
      await expect(arena.locator(".battle-result .combat-log")).toBeVisible();
      await expect(page.locator(".page-heading h1")).toHaveText(section);
      await expect(page.locator('#game-navigation button[aria-current="page"]')).toHaveAttribute(
        "aria-label",
        section,
      );
      if (section === "Explorar") {
        const firstId = await arena.getAttribute("data-battle-id");
        await database.db
          .update(s.characters)
          .set({ nextBattleAt: null })
          .where(eq(s.characters.id, initial.character.id));
        await page.evaluate(() => window.dispatchEvent(new Event("focus")));
        await expect(startFight()).toBeEnabled();
        await startFight().click();
        await expect(arena).not.toHaveAttribute("data-battle-id", firstId!);
        await expect(page.locator(".page-heading h1")).toHaveText("Explorar");
        await expect
          .poll(() =>
            page
              .locator(".battle-arena-anchor")
              .evaluate((el) => Math.round(el.getBoundingClientRect().top)),
          )
          .toBe(20);
      }

      // Explicit menu navigation still opens the selected page at its beginning.
      await go(page, "Inventário");
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(2);
    });
  }
}
