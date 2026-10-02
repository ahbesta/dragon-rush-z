import type { Requirements } from "./types";
import { xpRequired } from "./progression";

export const trainingMaxSeconds = 24 * 60 * 60;
export const trainingMinSeconds = 5 * 60;
export type TrainingDefinition = {
  id: string;
  name: string;
  masterId: string;
  location: string;
  description: string;
  artId: string;
  baseXpPerHour: number;
  levelRatePercent: number;
  requirements: Requirements;
  order: number;
};
export type IdleTraining = {
  trainingId: string;
  xpPerHour: number;
  startedAt: string;
};

/** Passive growth complements combat; freeze this rate when a session starts. */
export function trainingHourlyXp(
  training: Pick<TrainingDefinition, "baseXpPerHour" | "levelRatePercent">,
  level: number,
) {
  if (
    !Number.isSafeInteger(level) ||
    level < 1 ||
    !Number.isSafeInteger(training.baseXpPerHour) ||
    training.baseXpPerHour < 1 ||
    !Number.isSafeInteger(training.levelRatePercent) ||
    training.levelRatePercent < 0 ||
    training.levelRatePercent > 100
  )
    throw new Error("Rendimento de treinamento inválido.");
  return Math.max(
    training.baseXpPerHour,
    Math.floor((xpRequired(level) * training.levelRatePercent) / 100),
  );
}

/** Used for presentation too; rewards always use the database clock inside the transaction. */
export function trainingProgress(session: IdleTraining, finishesAt: string, now: number) {
  const started = Date.parse(session.startedAt);
  const finishes = Date.parse(finishesAt);
  if (
    !Number.isFinite(started) ||
    !Number.isFinite(finishes) ||
    !Number.isFinite(now) ||
    !Number.isSafeInteger(session.xpPerHour) ||
    session.xpPerHour < 1
  )
    throw new Error("Sessão de treinamento inválida.");
  const limit = Math.min(trainingMaxSeconds, Math.max(0, (finishes - started) / 1000));
  const seconds = Math.floor(Math.max(0, Math.min(limit, (now - started) / 1000)));
  const xp = Math.floor((seconds * session.xpPerHour) / 3600);
  if (!Number.isSafeInteger(xp)) throw new Error("XP de treinamento inválida.");
  return {
    seconds,
    xp,
    maxXp: Math.floor((limit * session.xpPerHour) / 3600),
    nextXpInSeconds: Math.max(0, Math.ceil(((xp + 1) * 3600) / session.xpPerHour) - seconds),
    capped: now >= Math.min(finishes, started + trainingMaxSeconds * 1000),
    canCollect: seconds >= trainingMinSeconds,
    claimAt: new Date(started + trainingMinSeconds * 1000).toISOString(),
  };
}

export function formatTrainingTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}
