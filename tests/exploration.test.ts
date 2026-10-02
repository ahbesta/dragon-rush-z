import { describe, it, expect } from "vitest";
import { seedCatalog } from "@/server/db/seed-data";
import { explorationBattlePresentation } from "@/lib/exploration-presentation";
import type { BattleResult, GameSnapshot } from "@/game/types";
import {
  createExplorationSession,
  selectExplorationEvent,
  resolveExploration,
  finishExploration,
  presentExploration,
  explorationChance,
  choiceAvailability,
} from "@/game/exploration/rules";
const character = {
  level: 25,
  raceId: "saiyajin",
  flags: [] as string[],
  hp: 100,
  ki: 100,
  zeni: 100,
  equipment: {},
};
const ctx = {
  character,
  powerLevel: 10000,
  maxHp: 100,
  inventory: [] as { itemId: string; quantity: number }[],
  items: seedCatalog.items,
};
const attrs = { strength: 20, defense: 20, speed: 20, endurance: 20, kiControl: 20 };
const event = (id: string) => seedCatalog.explorationEvents.find((e) => e.id === id)!;
describe("Exploração: regras e catálogo", () => {
  it("revela todos os achados após emboscada sem alterar a batalha salva", () => {
    const battle: BattleResult = {
      version: 2,
      id: "fight",
      enemyId: "lobo",
      outcome: "victory",
      playerHp: 100,
      playerKi: 50,
      xp: 20,
      zeni: 10,
      drops: [{ itemId: "erva", quantity: 1 }],
      events: [],
    };
    const encounter = finishExploration(
      {
        ...createExplorationSession(event("floresta-gather"), "enc", attrs, () => 0),
        battleId: "fight",
        pending: { items: [{ itemId: "erva", quantity: 2 }], xp: 0, zeni: 0, flags: [] },
      },
      "success",
      "Venceu",
    );
    const snapshot: GameSnapshot = {
      serverTime: "2026-10-02T00:00:00Z",
      character: {
        ...character,
        id: "hero",
        name: "Guerreiro",
        level: 1,
        xp: 0,
        base: attrs,
        selectedTechniques: ["soco"],
        combatMode: "automatic",
        nextBattleAt: null,
      },
      stats: { ...attrs, maxHp: 100, maxKi: 50, powerLevel: 100 },
      xpRequired: 100,
      race: seedCatalog.races[0],
      catalog: seedCatalog,
      inventory: [],
      learnedTechniques: ["soco"],
      unlockedTransformations: [],
      activity: null,
      history: [],
      latestBattle: battle,
      activeBattle: null,
      latestExploration: {
        id: encounter.id,
        areaId: "floresta",
        title: "Achado",
        category: "gather",
        rarity: "common",
        status: "success",
        message: "Venceu",
        rewards: encounter.granted,
        lost: encounter.lost,
        log: [],
        battleId: "fight",
      },
    };
    const presented = explorationBattlePresentation(snapshot);
    expect(presented.latestBattle!.drops).toEqual([{ itemId: "erva", quantity: 3 }]);
    expect(battle.drops).toEqual([{ itemId: "erva", quantity: 1 }]);
    expect(presented.latestBattle!.xp).toBe(20);
    expect(
      explorationBattlePresentation({
        ...snapshot,
        latestExploration: { ...snapshot.latestExploration!, battleId: "another" },
      }),
    ).toMatchObject({ latestBattle: battle });
  });
  it("cobre as 16 áreas com 6 ocorrências completas cada", () => {
    expect(seedCatalog.explorationEvents).toHaveLength(96);
    for (const area of seedCatalog.areas)
      expect(seedCatalog.explorationEvents.filter((e) => e.areaId === area.id)).toHaveLength(6);
  });
  it("valida todos os destinos, materiais, receitas e inimigos", () => {
    for (const e of seedCatalog.explorationEvents) {
      expect(e.stages.length).toBeLessThanOrEqual(2);
      for (const stage of e.stages)
        for (const choice of stage.choices)
          for (const outcome of [choice.success, choice.failure].filter(Boolean)) {
            if (outcome!.nextStageId)
              expect(e.stages.some((s) => s.id === outcome!.nextStageId)).toBe(true);
            if (outcome!.enemyId) {
              expect(seedCatalog.enemies.find((x) => x.id === outcome!.enemyId)?.boss).toBe(false);
              expect(
                seedCatalog.encounters.some(
                  (x) => x.areaId === e.areaId && x.enemyId === outcome!.enemyId,
                ),
              ).toBe(true);
            }
            for (const drop of outcome!.reward?.items ?? [])
              expect(seedCatalog.items.some((i) => i.id === drop.itemId)).toBe(true);
          }
    }
    for (const r of seedCatalog.recipes) {
      expect(seedCatalog.items.some((i) => i.id === r.outputItemId)).toBe(true);
      expect(seedCatalog.settlements.some((s) => s.id === r.settlementId)).toBe(true);
    }
  });
  it.each([
    [10, 10, 50],
    [5, 10, 25],
    [100, 10, 90],
    [0, 10, 10],
  ])("calcula chance para %i / %i", (value, target, chance) =>
    expect(explorationChance(value, target)).toBe(chance),
  );
  it("rejeita dificuldades inválidas", () => expect(() => explorationChance(10, 0)).toThrow());
  it("reflete os pesos sem elevar o raro em caminhos descobertos", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 10000; i++) {
      const selected = selectExplorationEvent(
        seedCatalog.explorationEvents,
        "floresta",
        ctx,
        () => i / 10000,
        seedCatalog.explorationRoutes[0],
      );
      counts.set(selected.category, (counts.get(selected.category) ?? 0) + 1);
    }
    expect(counts.get("discovery")).toBe(450);
    expect(counts.get("exceptional")).toBe(50);
    expect(counts.get("gather")!).toBeGreaterThan(3500);
    expect(counts.get("danger")!).toBeLessThan(1500);
  });
  it("coleta não concede XP e fica pendente até voltar", () => {
    const s = createExplorationSession(event("floresta-gather"), "test", attrs, () => 0);
    const a = resolveExploration(s, 0, "collect", ctx).session;
    expect(a.pending.items).toEqual([{ itemId: "erva", quantity: 1 }]);
    expect(a.granted.items).toEqual([]);
    expect(a.pending.xp).toBe(0);
    expect(a.stageId).toBe("deeper");
    const b = resolveExploration(a, 1, "retreat", ctx).session;
    expect(b.granted.items).toEqual(a.pending.items);
    expect(b.pending.items).toEqual([]);
  });
  it("falha perde todos os achados, não os itens anteriores", () => {
    const s = createExplorationSession(event("kame-house-gather"), "test", attrs, () => 0.999);
    const a = resolveExploration(s, 0, "collect", ctx).session;
    const result = resolveExploration(a, 1, "push", ctx);
    expect(result.session.status).toBe("failed");
    expect(result.session.granted.items).toEqual([]);
    expect(result.session.lost.items).toEqual([{ itemId: "erva", quantity: 1 }]);
    expect(result.damage).toBe(40);
    expect(ctx.inventory).toEqual([]);
  });
  it("abandonar perde achados e não concede descobertas", () => {
    const s = createExplorationSession(event("floresta-gather"), "test", attrs, () => 0);
    const a = resolveExploration(s, 0, "collect", ctx).session;
    const abandoned = finishExploration(a, "abandoned", "Saiu");
    expect(abandoned.granted.flags).toEqual([]);
    expect(abandoned.lost.items).toHaveLength(1);
  });
  it("esconde resultados futuros, sorteios e definições privadas", () => {
    const s = createExplorationSession(event("floresta-treasure"), "test", attrs, () => 0.1);
    const visible = presentExploration(s, ctx);
    expect(visible).not.toHaveProperty("rolls");
    expect(visible).not.toHaveProperty("event");
    expect(visible.choices[0]).not.toHaveProperty("success");
    expect(visible.choices[0]).not.toHaveProperty("failure");
    expect(visible.choices[0]).not.toHaveProperty("onceFlag");
  });
  it("rejeita revisão antiga, escolha de outra etapa e encontro finalizado", () => {
    const s = createExplorationSession(event("floresta-gather"), "test", attrs, () => 0);
    expect(() => resolveExploration(s, 0, "push", ctx)).toThrow();
    const a = resolveExploration(s, 0, "collect", ctx).session;
    expect(() => resolveExploration(a, 0, "retreat", ctx)).toThrow();
    expect(() =>
      resolveExploration(finishExploration(a, "success", "Saiu"), 1, "retreat", ctx),
    ).toThrow();
  });
  it("poções e recursos são checados antes da escolha", () => {
    const s = createExplorationSession(event("floresta-npc"), "test", attrs, () => 0);
    expect(() => resolveExploration(s, 0, "help", ctx)).toThrow();
    const withItems = { ...ctx, inventory: [{ itemId: "erva", quantity: 3 }] };
    expect(resolveExploration(s, 0, "help", withItems).session.granted.flags).toEqual([
      "discovery:floresta:npc",
    ]);
  });
  it("não repete recompensa de descoberta permanente", () => {
    const s = createExplorationSession(event("floresta-discovery"), "test", attrs, () => 0);
    expect(() =>
      resolveExploration(s, 0, "discover", {
        ...ctx,
        character: { ...character, flags: ["discovery:floresta:route"] },
      }),
    ).toThrow();
  });
  it("mapa regional melhora testes apenas na região, sem empilhar cópias", () => {
    const s = createExplorationSession(
      event("floresta-danger"),
      "test",
      { ...attrs, speed: 10 },
      () => 0,
    );
    const choice = s.event.stages[0].choices[0];
    const base = choiceAvailability(s, choice, ctx).chance;
    expect(
      choiceAvailability(s, choice, {
        ...ctx,
        inventory: [{ itemId: "mapa-floresta", quantity: 100 }],
      }).chance,
    ).toBe(base + 10);
    expect(
      choiceAvailability(s, choice, {
        ...ctx,
        inventory: [{ itemId: "mapa-montanhas", quantity: 1 }],
      }).chance,
    ).toBe(base);
  });
  it("nenhum perigo de vila sorteia um boss ou combate", () => {
    for (const area of seedCatalog.areas.filter((a) => a.hub))
      for (const stage of event(`${area.id}-danger`).stages)
        for (const choice of stage.choices) expect(choice.failure?.enemyId).toBeUndefined();
  });
  it("emboscada não guarda achados antes da vitória", () => {
    const s = createExplorationSession(event("floresta-danger"), "test", attrs, () => 0.99);
    const a = resolveExploration(s, 0, "cross", ctx).session;
    expect(a.status).toBe("battle");
    expect(a.enemyId).toBe("lobo");
    expect(a.granted.items).toEqual([]);
  });
});
