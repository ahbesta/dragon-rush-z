import { describe, expect, it } from "vitest";
import {
  trainingProgress,
  trainingMaxSeconds,
  trainingHourlyXp,
  formatTrainingTime,
} from "@/game/training";
import { xpRequired, applyExperience } from "@/game/progression";
import { seedCatalog } from "@/server/db/seed-data";
import { trainingCatalog } from "@/server/db/training-catalog";
import { unmetRequirements } from "@/game/requirements";
import { actionInput } from "@/game/validation";
import { randomUUID } from "node:crypto";

const started = Date.UTC(2026, 9, 2, 10);
const session = {
  trainingId: "karin",
  xpPerHour: 75,
  startedAt: new Date(started).toISOString(),
};
const finishes = new Date(started + trainingMaxSeconds * 1000).toISOString();
describe("Treinamento idle", () => {
  it("o rendimento respeita a curva de XP e cresce entre os mestres", () => {
    expect(xpRequired(24)).toBe(1250);
    expect(trainingCatalog.map((t) => trainingHourlyXp(t, 24))).toEqual([37, 50, 75, 100]);
    expect(trainingCatalog.map((t) => trainingHourlyXp(t, 1))).toEqual([20, 30, 45, 60]);
    expect(trainingCatalog.map((t) => trainingHourlyXp(t, 25))).toEqual([39, 52, 78, 104]);
  });
  it("um dia não pula dezenas de níveis nem cresce durante a sessão", () => {
    const race = seedCatalog.races[0];
    for (const level of [24, 25, 50, 100, 250])
      for (const training of trainingCatalog) {
        const rate = trainingHourlyXp(training, level);
        const xp = trainingProgress(
          { ...session, xpPerHour: rate },
          finishes,
          started + trainingMaxSeconds * 1000,
        ).xp;
        expect(xp).toBeLessThanOrEqual(xpRequired(level) * 1.92);
        expect(applyExperience(level, 0, xp, race.base, race).level - level).toBeLessThanOrEqual(1);
      }
    expect(
      trainingProgress(
        { ...session, xpPerHour: 100 },
        finishes,
        started + trainingMaxSeconds * 1000,
      ).xp,
    ).toBe(2400);
  });
  it("acumula por segundos completos e só permite coletar após cinco minutos", () => {
    expect(trainingProgress(session, finishes, started + 299999)).toMatchObject({
      seconds: 299,
      xp: 6,
      canCollect: false,
    });
    expect(trainingProgress(session, finishes, started + 300000)).toMatchObject({
      seconds: 300,
      xp: 6,
      canCollect: true,
    });
    expect(trainingProgress(session, finishes, started + 3600000)).toMatchObject({
      seconds: 3600,
      xp: 75,
      capped: false,
    });
  });
  it("offline ou além do prazo nunca concede mais que 24h", () => {
    const capped = trainingProgress(session, finishes, started + 24 * 3600000);
    expect(capped).toMatchObject({ seconds: 86400, xp: 1800, maxXp: 1800, capped: true });
    expect(trainingProgress(session, finishes, started + 72 * 3600000)).toEqual(capped);
    expect(
      trainingProgress(
        session,
        new Date(started + 96 * 3600000).toISOString(),
        started + 72 * 3600000,
      ).xp,
    ).toBe(1800);
  });
  it("não produz XP negativa nem aceita relógio ou taxa inválidos", () => {
    expect(trainingProgress(session, finishes, started - 10000)).toMatchObject({
      seconds: 0,
      xp: 0,
      canCollect: false,
    });
    for (const xpPerHour of [-1, 0, 1.5, NaN, Infinity])
      expect(() => trainingProgress({ ...session, xpPerHour }, finishes, started)).toThrow();
    expect(() => trainingProgress(session, finishes, NaN)).toThrow();
    expect(() => trainingHourlyXp(trainingCatalog[0], 0)).toThrow();
    expect(
      trainingProgress({ ...session, xpPerHour: 20 }, finishes, started + 60000).nextXpInSeconds,
    ).toBe(120);
  });
  it("um nível alto sozinho não libera os desafios de mestres", () => {
    for (const training of trainingCatalog.slice(1)) {
      const context = { level: 999, powerLevel: 999999, raceId: "saiyajin", flags: [] as string[] };
      expect(unmetRequirements(training.requirements, context).length).toBeGreaterThan(0);
      context.flags = [
        ...(training.requirements.flags ?? []),
        ...(training.requirements.masterId ? [`master:${training.requirements.masterId}`] : []),
      ];
      expect(unmetRequirements(training.requirements, context)).toEqual([]);
    }
    expect(trainingCatalog.map((t) => t.baseXpPerHour)).toEqual([20, 30, 45, 60]);
  });
  it("o cliente só escolhe um treino, nunca a taxa, início, XP ou duração", () => {
    const input = { action: "training.start", trainingId: "karin", idempotencyKey: randomUUID() };
    expect(actionInput.safeParse(input).success).toBe(true);
    for (const field of [
      "xp",
      "xpPerMinute",
      "xpPerHour",
      "baseXpPerHour",
      "levelRatePercent",
      "startedAt",
      "durationSeconds",
    ])
      expect(actionInput.safeParse({ ...input, [field]: 999999 }).success).toBe(false);
  });
  it("mostra tempos longos sem transformar 24 horas em segundos ilegíveis", () => {
    expect(formatTrainingTime(86400)).toBe("24:00:00");
    expect(formatTrainingTime(3661)).toBe("01:01:01");
  });
});
