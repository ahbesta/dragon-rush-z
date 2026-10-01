import { expect, type Locator } from "@playwright/test";

export async function openBattleCommands(arena: Locator, tab?: "Técnicas" | "Itens") {
  const panel = arena.getByRole("group", { name: "Menu de turno", exact: true });
  await expect(panel).toBeVisible();
  const back = panel.getByRole("button", { name: "Voltar aos comandos", exact: true });
  if (await back.isVisible()) await back.click();
  if (tab) await panel.getByRole("button", { name: new RegExp(`^${tab}`) }).click();
  return panel;
}
