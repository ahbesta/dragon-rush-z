"use client";
import { ArrowRight, LockKeyhole, Swords } from "lucide-react";
import type { GameSnapshot } from "@/game/types";
import type { ActionPayload } from "@/game/validation";
import { requiresManualCombat } from "@/game/combat-access";
import { unmetRequirements } from "@/game/requirements";
import { RegionSelector } from "./region-selector";
import { EnemyPortrait } from "./enemy-portrait";
import { EnemyDrops } from "./enemy-intel";

export function BattleDestinations({
  snapshot,
  areaId,
  onArea,
  busy,
  wait,
  onAction,
  onVillage,
}: {
  snapshot: GameSnapshot;
  areaId: string;
  onArea: (id: string) => void;
  busy: boolean;
  wait: number;
  onAction: (action: ActionPayload) => void;
  onVillage: () => void;
}) {
  const { character, catalog } = snapshot;
  const context = {
    level: character.level,
    powerLevel: snapshot.stats.powerLevel,
    raceId: character.raceId,
    flags: character.flags,
  };
  const reasons = (area: GameSnapshot["catalog"]["areas"][number]) =>
    unmetRequirements({ ...area.requirements, minLevel: area.minLevel }, context);
  const area = catalog.areas.find((a) => a.id === areaId) ?? catalog.areas[0];
  const areaReasons = reasons(area);
  const enemies = catalog.encounters
    .filter((e) => e.areaId === area.id)
    .map((e) => catalog.enemies.find((enemy) => enemy.id === e.enemyId)!)
    .filter(Boolean);
  const canFight = !busy && wait === 0 && areaReasons.length === 0 && character.hp > 0;
  return (
    <section className="battle-destinations" aria-label="Escolher área e adversário">
      <RegionSelector snapshot={snapshot} areaId={areaId} onArea={onArea} />
      <section className="panel encounter-panel">
        <div className="section-title">
          <h3>
            <Swords size={19} /> 02 · Escolha seu adversário
          </h3>
        </div>
        {areaReasons.length > 0 ? (
          <p className="battle-area-locked">
            <LockKeyhole size={15} /> Área bloqueada: {areaReasons.join(" · ")}
          </p>
        ) : (
          <p className="panel-description">
            {snapshot.activeBattle
              ? "Conclua a batalha em andamento na arena abaixo."
              : "Escolha um inimigo para entrar na arena. Vença cada boss manualmente uma vez para liberar seu farm automático."}
          </p>
        )}
        <div className="enemy-list">
          {enemies.map((enemy) => {
            const locked = unmetRequirements(enemy.requirements, context);
            return (
              <div
                className={`enemy-row${snapshot.activeBattle?.enemyId === enemy.id ? " enemy-selected" : ""}`}
                key={enemy.id}
              >
                <EnemyPortrait enemyId={enemy.id} artId={enemy.artId} />
                <div className="enemy-info">
                  <strong>{enemy.name}</strong>
                  <small>
                    {enemy.boss ? "BOSS · " : ""}Nível {enemy.level} · PL {enemy.powerLevel} ·{" "}
                    {enemy.maxHp} HP
                  </small>
                  {locked.length > 0 && (
                    <small className="battle-enemy-requirements">
                      <LockKeyhole size={11} /> {locked.join(" · ")}
                    </small>
                  )}
                </div>
                <div className="enemy-rewards">
                  <span>+{enemy.xpReward} XP</span>
                  <small>◈ {enemy.zeniReward} Zeni</small>
                </div>
                <button
                  className={`button small ${enemy.boss ? "primary" : "secondary"}`}
                  disabled={!canFight || locked.length > 0}
                  aria-describedby={
                    snapshot.activeExploration ? "expedition-lock-message" : undefined
                  }
                  onClick={() =>
                    onAction(
                      enemy.boss
                        ? { action: "boss", enemyId: enemy.id }
                        : { action: "battle", areaId: area.id, enemyId: enemy.id },
                    )
                  }
                >
                  {wait
                    ? `${wait}s`
                    : enemy.boss
                      ? requiresManualCombat(enemy, snapshot.character.flags) ||
                        snapshot.character.combatMode === "manual"
                        ? "Desafiar · manual"
                        : "Desafiar · automático"
                      : "Batalhar"}
                  <Swords size={14} />
                </button>
                <EnemyDrops enemy={enemy} snapshot={snapshot} />
              </div>
            );
          })}
          {!enemies.length && (
            <div className="battle-hub-message">
              <p>Esta área é uma vila. Prepare seus suprimentos antes de voltar à aventura.</p>
              <button className="button secondary small" onClick={onVillage}>
                Vilas e mercado <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
