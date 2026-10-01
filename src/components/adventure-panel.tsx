"use client";
import { Check, LockKeyhole, ScrollText, Swords, Trophy } from "lucide-react";
import type { GameSnapshot } from "@/game/types";
import type { ActionPayload } from "@/game/validation";
import { unmetRequirements } from "@/game/requirements";
import { questReady } from "@/game/economy";
import { Scene, formatNumber } from "./game-primitives";
export function AdventurePanel({
  snapshot,
  busy,
  onAction,
  onArea,
}: {
  snapshot: GameSnapshot;
  busy: boolean;
  onAction: (a: ActionPayload) => void;
  onArea: (areaId: string) => void;
}) {
  const { character: c, catalog } = snapshot;
  const context = {
    level: c.level,
    powerLevel: snapshot.stats.powerLevel,
    raceId: c.raceId,
    flags: c.flags,
  };
  const activeChapter = catalog.chapters.find(
    (ch) => !c.flags.includes(`quest:${ch.finaleQuestId}`),
  );
  return (
    <div className="rpg-campaign">
      <div className="rpg-heading">
        <span className="eyebrow orange">DRAGON BALL CLÁSSICO</span>
        <h2>
          <ScrollText size={27} /> A história do seu guerreiro
        </h2>
        <p>
          Cada desafio abre um caminho. Prepare sua build, reúna suprimentos e supere os mestres.
        </p>
      </div>
      {catalog.chapters.map((ch) => {
        const completed = c.flags.includes(`quest:${ch.finaleQuestId}`);
        return (
          <details
            key={ch.id}
            className={`panel rpg-chapter${completed ? " completed" : ""}`}
            open={ch.id === activeChapter?.id}
          >
            <summary>
              <div className="rpg-chapter-thumb">
                <Scene kind={ch.art} />
              </div>
              <div>
                <span className="eyebrow">
                  CAPÍTULO {ch.order} · NÍVEL {ch.minLevel}+
                </span>
                <h3>{ch.name}</h3>
                <p>{ch.description}</p>
              </div>
              {completed ? <Check size={24} /> : <Trophy size={24} />}
            </summary>
            <div className="rpg-quest-list">
              {catalog.quests
                .filter((q) => q.chapterId === ch.id)
                .map((q) => {
                  const reasons = unmetRequirements(q.requirements, context);
                  const progress = c.questProgress?.find((p) => p.questId === q.id);
                  const ready = questReady(q, progress, snapshot.inventory);
                  return (
                    <article className={`rpg-quest${reasons.length ? " locked" : ""}`} key={q.id}>
                      <div>
                        <span className={`badge ${progress?.claimed ? "green" : ""}`}>
                          {progress?.claimed
                            ? "CONCLUÍDA"
                            : reasons.length
                              ? "BLOQUEADA"
                              : ready
                                ? "RECOMPENSA DISPONÍVEL"
                                : "EM ANDAMENTO"}
                        </span>
                        <h4>{q.name}</h4>
                        <p>{q.description}</p>
                      </div>
                      <ul>
                        {q.objectives.map((o, index) => {
                          const current =
                            o.kind === "deliver"
                              ? (snapshot.inventory.find((i) => i.itemId === o.itemId)?.quantity ??
                                0)
                              : (progress?.counters[String(index)] ?? 0);
                          const name =
                            o.kind === "defeat"
                              ? catalog.enemies.find((e) => e.id === o.enemyId)?.name
                              : o.kind === "deliver"
                                ? catalog.items.find((i) => i.id === o.itemId)?.name
                                : "Sessões de treinamento";
                          return (
                            <li key={index}>
                              {progress?.claimed ? (
                                <Check size={14} />
                              ) : (
                                <span className="rpg-dot" />
                              )}
                              <span>
                                {o.kind === "deliver"
                                  ? "Entregar "
                                  : o.kind === "defeat"
                                    ? "Vencer "
                                    : ""}
                                {name}
                              </span>
                              <strong>
                                {progress?.claimed ? o.quantity : Math.min(current, o.quantity)}/
                                {o.quantity}
                              </strong>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="rpg-quest-reward">
                        +{formatNumber(q.rewards.xp)} XP · ◈ {q.rewards.zeni} Zeni
                        {q.rewards.items?.map((i) => (
                          <span key={i.itemId}>
                            {" "}
                            · {i.quantity} {catalog.items.find((it) => it.id === i.itemId)?.name}
                          </span>
                        ))}
                      </div>
                      {reasons.length > 0 && (
                        <small className="muted">
                          <LockKeyhole size={12} /> {reasons.join(" · ")}
                        </small>
                      )}
                      {!progress?.claimed && reasons.length === 0 && (
                        <div className="rpg-actions">
                          <button
                            className="button primary small"
                            disabled={busy || !ready}
                            onClick={() => onAction({ action: "quest.claim", questId: q.id })}
                          >
                            Receber recompensa
                          </button>
                          {q.objectives
                            .filter((o) => o.kind === "defeat")
                            .map((o) => {
                              if (o.kind !== "defeat") return null;
                              const enemy = catalog.enemies.find((e) => e.id === o.enemyId)!;
                              const area = catalog.encounters.find(
                                (e) => e.enemyId === enemy.id,
                              )?.areaId;
                              const locked =
                                unmetRequirements(enemy.requirements, context).length > 0;
                              return (
                                <button
                                  key={o.enemyId}
                                  className="button secondary small"
                                  disabled={busy || locked}
                                  onClick={() =>
                                    enemy.boss
                                      ? onAction({ action: "boss", enemyId: enemy.id })
                                      : area && onArea(area)
                                  }
                                >
                                  <Swords size={14} />
                                  {enemy.boss ? `Desafiar ${enemy.name}` : "Ir ao local"}
                                </button>
                              );
                            })}
                        </div>
                      )}
                    </article>
                  );
                })}
            </div>
          </details>
        );
      })}
    </div>
  );
}
