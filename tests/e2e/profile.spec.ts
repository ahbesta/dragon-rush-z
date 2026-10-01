import { test, expect } from "./browser-test";
import { type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { createDatabase } from "../../src/server/db/client";
import * as s from "../../src/server/db/schema";
import type { GameSnapshot } from "../../src/game/types";

const email = `profile-${randomUUID()}@example.test`;
const password = `${randomUUID()}Test!`;
const nextPassword = `${randomUUID()}New!`;
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

test("perfil protegido, nome, preferência e troca real de senha com revogação de sessões", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const origin = { origin: baseURL! };
  await page.goto("/perfil");
  await expect(page).toHaveURL(/\/login$/);
  const unauthenticated = await page.request.post("/api/auth/update-user", {
    headers: origin,
    data: { name: "Intruso" },
  });
  expect(unauthenticated.status()).toBe(401);
  const noPasswordSession = await page.request.post("/api/auth/change-password", {
    headers: origin,
    data: { currentPassword: password, newPassword: nextPassword },
  });
  expect(noPasswordSession.status()).toBe(401);

  const signup = await page.request.post("/api/auth/sign-up/email", {
    headers: origin,
    data: { email, password, name: "Teste Perfil" },
  });
  expect(signup.ok()).toBe(true);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/jogo");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Perfil", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Perfil", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Criar personagem", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByLabel("Email da conta")).toHaveAttribute("readonly", "");
  await page.getByLabel("Nome da conta", { exact: true }).fill("  Rafael Teste  ");
  await page.getByRole("button", { name: "Salvar nome", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Nome da conta atualizado.");
  await page.reload();
  await expect(page.getByLabel("Nome da conta", { exact: true })).toHaveValue("Rafael Teste");

  for (const name of [" ", "A".repeat(61), "Nome\nInválido"]) {
    const forged = await page.request.post("/api/auth/update-user", {
      headers: origin,
      data: { name },
    });
    expect(forged.status()).toBe(400);
    expect((await forged.json()).code).toBe("INVALID_PROFILE_NAME");
  }
  const creation = await page.request.post("/api/game/characters", {
    headers: origin,
    data: { name: "GuerreiroPerfil", raceId: "saiyajin", idempotencyKey: randomUUID() },
  });
  expect(creation.ok()).toBe(true);
  const before = await state(page);
  await page.goto("/jogo");
  await page.getByRole("link", { name: "Perfil", exact: true }).click();
  await expect(page.getByRole("heading", { name: "GuerreiroPerfil", exact: true })).toBeVisible();
  const selector = page.getByRole("region", { name: "Modo de combate", exact: true });
  const modeResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/game/actions") && response.request().method() === "POST",
  );
  await selector.getByRole("button", { name: /Manual/ }).click();
  const changedMode = await modeResponse;
  expect(changedMode.ok()).toBe(true);
  expect((await changedMode.json()).snapshot.character.combatMode).toBe("manual");
  await expect(page.getByRole("status")).toContainText(/Combate/);
  await expect(selector.getByRole("button", { name: /Manual/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.reload();
  await expect(selector.getByRole("button", { name: /Manual/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const expectedGame = await state(page);
  expect(expectedGame.character).toMatchObject({
    name: before.character.name,
    xp: before.character.xp,
    level: before.character.level,
    zeni: before.character.zeni,
  });

  const other = await browser.newContext({ baseURL });
  const passwordPanel = page.getByRole("region", { name: "Alterar senha", exact: true });
  try {
    const login = await other.request.post("/api/auth/sign-in/email", {
      headers: origin,
      data: { email, password },
    });
    expect(login.ok()).toBe(true);
    expect((await other.request.get("/api/game")).ok()).toBe(true);
    await page.getByLabel("Senha atual", { exact: true }).fill(password);
    await page.getByLabel("Nova senha", { exact: true }).fill(nextPassword);
    await page.getByLabel("Confirmar nova senha", { exact: true }).fill("OutraSenha123!");
    await page.getByRole("button", { name: "Alterar senha", exact: true }).click();
    await expect(passwordPanel.getByRole("alert")).toHaveText(
      "A confirmação não corresponde à nova senha.",
    );
    await page.getByLabel("Confirmar nova senha", { exact: true }).fill(nextPassword);
    await page.getByLabel("Senha atual", { exact: true }).fill("SenhaIncorreta123!");
    await page.getByRole("button", { name: "Alterar senha", exact: true }).click();
    await expect(passwordPanel.getByRole("alert")).toHaveText("A senha atual está incorreta.");
    expect((await other.request.get("/api/game")).ok()).toBe(true);
    const tooShort = await page.request.post("/api/auth/change-password", {
      headers: origin,
      data: { currentPassword: password, newPassword: "1234567", revokeOtherSessions: true },
    });
    expect(tooShort.status()).toBe(400);
    await page.getByRole("button", { name: "Mostrar senhas", exact: true }).click();
    await expect(page.getByLabel("Nova senha", { exact: true })).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Ocultar senhas", exact: true }).click();
    await page.getByLabel("Senha atual", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Alterar senha", exact: true }).click();
    await expect(passwordPanel.getByRole("status")).toContainText("Senha alterada.");
    await expect(page.getByLabel("Senha atual", { exact: true })).toHaveValue("");
    await expect(page.getByLabel("Nova senha", { exact: true })).toHaveValue("");
    expect((await other.request.get("/api/game")).status()).toBe(401);
    const after = await state(page);
    expect(after.character).toEqual(expectedGame.character);
    expect(after.inventory).toEqual(expectedGame.inventory);
    expect(after.learnedTechniques).toEqual(expectedGame.learnedTechniques);
    await page.reload();
    await expect(page.getByLabel("Nome da conta", { exact: true })).toHaveValue("Rafael Teste");

    // Nunca captura campos com a senha de teste preenchida.
    await mkdir(".local/screenshots", { recursive: true });
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `Perfil em ${width}px`,
      ).toBe(true);
      if (width === 1440 || width === 390)
        await page.screenshot({ path: `.local/screenshots/profile-${width}.png`, fullPage: true });
      await page.getByRole("link", { name: "Voltar ao jogo", exact: true }).click();
      const menu = page.getByRole("button", { name: "Abrir menu", exact: true });
      if (await menu.isVisible()) await menu.click();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `Menu do jogo em ${width}px`,
      ).toBe(true);
      await page.getByRole("link", { name: "Perfil", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Perfil", exact: true })).toBeVisible();
    }
    const oldLogin = await other.request.post("/api/auth/sign-in/email", {
      headers: origin,
      data: { email, password },
    });
    expect(oldLogin.status()).toBe(401);
    const newLogin = await other.request.post("/api/auth/sign-in/email", {
      headers: origin,
      data: { email, password: nextPassword },
    });
    expect(newLogin.ok()).toBe(true);
  } finally {
    await other.close();
  }
  expect(errors).toEqual([]);
});
