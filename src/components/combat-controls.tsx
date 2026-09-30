"use client";
import { useState } from "react";
import { Bot, Hand, LoaderCircle, Swords, UserRound } from "lucide-react";
import type { ActionPayload } from "@/game/validation";
import type { GameSnapshot } from "@/game/types";
import { techniqueArtwork } from "@/lib/game-art";
import { ArtworkImage } from "./artwork-image";
import { EnemyPortrait } from "./enemy-portrait";
import { Meter } from "./game-primitives";
import { CombatEventLog } from "./battle-log";

type Controls = {
  snapshot: GameSnapshot;
  busy: boolean;
  onAction: (payload: ActionPayload) => void;
};
export function CombatModeSelector({ snapshot, busy, onAction }: Controls) {
  const mode = snapshot.character.combatMode;
  return (
    <section className="combat-mode-panel" aria-label="Modo de combate">
      <div>
        <span className="eyebrow orange">SEU ESTILO DE LUTA</span>
        <h2>Modo de combate</h2>
        <p>
          {snapshot.activeBattle
            ? "Você pode assumir o automático para concluir esta luta."
            : mode === "manual"
              ? "Escolha uma técnica a cada rodada."
              : "Suas técnicas são usadas na prioridade definida."}
        </p>
      </div>
      <div className="combat-mode-options" role="group" aria-label="Escolher modo de combate">
        <button
          className={mode === "automatic" ? "selected" : ""}
          aria-pressed={mode === "automatic"}
          disabled={busy}
          onClick={() => onAction({ action: "combat.mode", mode: "automatic" })}
        >
          <Bot size={20} />
          <span>
            Automático<small>O guerreiro luta por você</small>
          </span>
        </button>
        <button
          className={mode === "manual" ? "selected" : ""}
          aria-pressed={mode === "manual"}
          disabled={busy}
          onClick={() => onAction({ action: "combat.mode", mode: "manual" })}
        >
          <Hand size={20} />
          <span>
            Manual<small>Você escolhe os golpes</small>
          </span>
        </button>
      </div>
    </section>
  );
}

export function ManualBattle({ snapshot, busy, onAction }: Controls) {
  const [expanded, setExpanded] = useState(false);
  const battle = snapshot.activeBattle;
  if (!battle) return null;
  const enemyName =
    snapshot.catalog.enemies.find((e) => e.id === battle.enemyId)?.name ?? "Inimigo";
  return (
    <section className="panel manual-battle" aria-label="Combate manual">
      <div className="section-title">
        <div>
          <span className="eyebrow orange">COMBATE EM ANDAMENTO</span>
          <h2>
            {snapshot.character.name} vs {enemyName}
          </h2>
        </div>
        <span className="badge">Rodada {battle.round}</span>
      </div>
      <div className="manual-fighters">
        <div className="manual-fighter">
          <div className="manual-player-art">
            <UserRound size={50} />
          </div>
          <div>
            <h3>{snapshot.character.name}</h3>
            <Meter label="Seu HP" value={battle.playerHp} max={snapshot.stats.maxHp} />
            <Meter label="Seu Ki" value={battle.playerKi} max={snapshot.stats.maxKi} variant="ki" />
          </div>
        </div>
        <span className="manual-versus">VS</span>
        <div className="manual-fighter">
          <EnemyPortrait enemyId={battle.enemyId} sizes="120px" />
          <div>
            <h3>{enemyName}</h3>
            <Meter label="HP do inimigo" value={battle.enemyHp} max={battle.enemyMaxHp} />
            <Meter
              label="Ki do inimigo"
              value={battle.enemyKi}
              max={battle.enemyMaxKi}
              variant="ki"
            />
          </div>
        </div>
      </div>
      <div className="manual-turn-heading">
        <Swords size={18} />
        <div>
          <h3>Escolha sua técnica</h3>
          <p>Os dois lados agem nesta rodada. Quem tem mais velocidade ataca primeiro.</p>
        </div>
      </div>
      <div className="manual-techniques">
        {battle.techniques.map((technique) => {
          const art = techniqueArtwork[technique.id];
          const reason =
            technique.cooldownRemaining > 0
              ? `Recarga: ${technique.cooldownRemaining} rodada(s)`
              : technique.kiCost > battle.playerKi
                ? "Ki insuficiente"
                : technique.kiCost
                  ? `${technique.kiCost} Ki`
                  : "Sem custo de Ki";
          return (
            <button
              key={technique.id}
              className="manual-technique"
              aria-label={`Usar ${technique.name}`}
              disabled={busy || !technique.available}
              onClick={() =>
                onAction({
                  action: "battle.turn",
                  battleId: battle.id,
                  round: battle.round,
                  techniqueId: technique.id,
                })
              }
            >
              {art ? <ArtworkImage art={art} sizes="80px" /> : <Swords size={28} />}
              <span>
                <strong>{technique.name}</strong>
                <small>{reason}</small>
              </span>
              {busy && <LoaderCircle className="spin" size={16} />}
            </button>
          );
        })}
      </div>
      <p className="manual-battle-hint">
        Sua luta fica salva. Você pode sair e continuar depois. Para concluir automaticamente,
        altere o modo acima.
      </p>
      <CombatEventLog
        events={expanded ? battle.events : battle.events.slice(-8)}
        names={{ player: snapshot.character.name, enemy: enemyName }}
      />
      {battle.events.length > 8 && (
        <button className="log-expand" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Recolher log" : "Ver todas as rodadas"}
        </button>
      )}
    </section>
  );
}
