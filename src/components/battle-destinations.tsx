"use client";
import { useRef, useState } from "react";
import { ArrowRight, Compass, LockKeyhole, Map, Search, Swords, X } from "lucide-react";
import type { GameSnapshot } from "@/game/types";
import type { ActionPayload } from "@/game/validation";
import { unmetRequirements } from "@/game/requirements";
import { Scene } from "./game-primitives";
import { EnemyPortrait } from "./enemy-portrait";
import { EnemyDrops } from "./enemy-intel";

export function BattleDestinations({
  snapshot,
  areaId,
  onArea,
  mode,
  busy,
  wait,
  onAction,
  onVillage,
}: {
  snapshot: GameSnapshot;
  areaId: string;
  onArea: (id: string) => void;
  mode: "battle" | "explore";
  busy: boolean;
  wait: number;
  onAction: (action: ActionPayload) => void;
  onVillage: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [filter, setFilter] = useState("available");
  const [search, setSearch] = useState("");
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
  const available = catalog.areas.filter((a) => reasons(a).length === 0);
  const visible = catalog.areas.filter(
    (a) =>
      (filter === "all" || reasons(a).length === 0) &&
      a.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")),
  );
  const enemies = catalog.encounters
    .filter((e) => e.areaId === area.id)
    .map((e) => catalog.enemies.find((enemy) => enemy.id === e.enemyId)!)
    .filter(Boolean);
  const canFight = !busy && wait === 0 && areaReasons.length === 0 && character.hp > 0;
  return (
    <section className="battle-destinations" aria-label="Escolher área e adversário">
      <div className="battle-destination-heading">
        <span className="eyebrow orange">01 · ESCOLHA SUA ÁREA</span>
        <small>
          <Compass size={13} /> {available.length}/{catalog.areas.length} disponíveis
        </small>
      </div>
      <div className="battle-area-current">
        <Scene kind={area.id} />
        <div>
          <span className="eyebrow">PLANETA TERRA · NÍVEL {area.minLevel}+</span>
          <h2>{area.name}</h2>
          <p>{area.description}</p>
        </div>
        <button className="button secondary" onClick={() => dialog.current?.showModal()}>
          <Map size={17} /> Trocar área
        </button>
      </div>
      <dialog
        ref={dialog}
        className="battle-area-picker"
        aria-labelledby="battle-area-picker-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <div className="battle-area-picker-header">
          <div>
            <span className="eyebrow orange">PLANETA TERRA</span>
            <h2 id="battle-area-picker-title">Escolha sua área</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Fechar seleção de área"
            autoFocus
            onClick={() => dialog.current?.close()}
          >
            <X size={22} />
          </button>
        </div>
        <div className="battle-area-picker-tools">
          <div className="rpg-tabs" role="group" aria-label="Filtrar áreas">
            <button
              className={filter === "available" ? "selected" : ""}
              onClick={() => setFilter("available")}
            >
              Disponíveis ({available.length})
            </button>
            <button className={filter === "all" ? "selected" : ""} onClick={() => setFilter("all")}>
              Todas as áreas ({catalog.areas.length})
            </button>
          </div>
          <label className="battle-area-search">
            <Search size={17} />
            <input
              aria-label="Buscar área"
              placeholder="Buscar área..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <div className="area-grid battle-area-picker-grid">
          {visible.map((a) => {
            const locked = reasons(a);
            const encounters = catalog.encounters.filter((e) => e.areaId === a.id).length;
            return (
              <button
                key={a.id}
                className={`area-card${a.id === area.id ? " selected" : ""}${locked.length ? " locked" : ""}`}
                aria-pressed={a.id === area.id}
                onClick={() => {
                  onArea(a.id);
                  dialog.current?.close();
                }}
              >
                <Scene kind={a.id} />
                <span className="area-level">
                  {locked.length ? <LockKeyhole size={12} /> : <Compass size={12} />} NÍVEL{" "}
                  {a.minLevel}+
                </span>
                <div>
                  <h3>{a.name}</h3>
                  <p>{a.description}</p>
                  <span>
                    {locked.length
                      ? "Bloqueada · ver requisitos"
                      : encounters
                        ? `${encounters} adversário(s)`
                        : "Vila · suprimentos"}
                    <ArrowRight size={13} />
                  </span>
                </div>
              </button>
            );
          })}
          {!visible.length && <p className="muted">Nenhuma área encontrada.</p>}
        </div>
      </dialog>
      <section className="panel encounter-panel">
        <div className="section-title">
          <h3>
            <Swords size={19} />{" "}
            {mode === "explore"
              ? "02 · Explore ou escolha um adversário"
              : "02 · Escolha seu adversário"}
          </h3>
          {mode === "explore" && enemies.some((e) => !e.boss) && (
            <button
              className="button primary small"
              disabled={!canFight}
              onClick={() => onAction({ action: "explore", areaId: area.id })}
            >
              <Compass size={16} /> {wait ? `Aguarde ${wait}s` : "Explorar e batalhar"}
            </button>
          )}
        </div>
        {areaReasons.length > 0 ? (
          <p className="battle-area-locked">
            <LockKeyhole size={15} /> Área bloqueada: {areaReasons.join(" · ")}
          </p>
        ) : (
          <p className="panel-description">
            {snapshot.activeBattle
              ? "Conclua a batalha em andamento na arena abaixo."
              : mode === "explore"
                ? "Explore para encontrar um inimigo comum ou escolha diretamente quem enfrentar. Bosses e provas são manuais."
                : "Escolha um inimigo para entrar na arena. Bosses e provas são sempre manuais."}
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
                  onClick={() =>
                    onAction(
                      enemy.boss
                        ? { action: "boss", enemyId: enemy.id }
                        : { action: "battle", areaId: area.id, enemyId: enemy.id },
                    )
                  }
                >
                  {wait ? `${wait}s` : enemy.boss ? "Desafiar · manual" : "Batalhar"}
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
