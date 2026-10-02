"use client";
import { useRef, useState } from "react";
import { ArrowRight, Compass, LockKeyhole, Map, Search, X } from "lucide-react";
import type { GameSnapshot } from "@/game/types";
import { unmetRequirements } from "@/game/requirements";
import { Scene } from "./game-primitives";
export function RegionSelector({
  snapshot,
  areaId,
  onArea,
  exploration = false,
}: {
  snapshot: GameSnapshot;
  areaId: string;
  onArea: (id: string) => void;
  exploration?: boolean;
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
  const available = catalog.areas.filter((a) => reasons(a).length === 0);
  const visible = catalog.areas.filter(
    (a) =>
      (filter === "all" || reasons(a).length === 0) &&
      a.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")),
  );

  return (
    <>
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
        <button
          className="button secondary"
          disabled={Boolean(snapshot.activeBattle || snapshot.activeExploration)}
          onClick={() => dialog.current?.showModal()}
        >
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
                      : exploration
                        ? "Encontros · descobertas"
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
    </>
  );
}
