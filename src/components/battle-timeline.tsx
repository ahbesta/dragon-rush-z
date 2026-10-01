"use client";
import { useState } from "react";
import { ChevronRight, History, X } from "lucide-react";
import type { ActiveBattle } from "@/game/types";
import type { BattleFrame } from "@/lib/battle-presentation";
import { combatTimeline } from "@/lib/combat-timeline";
import { CombatAvatar, type CombatActor, type CombatAvatars } from "./combat-avatar";

export function BattleTimeline({
  frames,
  frame,
  playing,
  active,
  fighters,
  onHighlight,
}: {
  frames: BattleFrame[];
  frame: BattleFrame | null;
  playing: boolean;
  active: ActiveBattle | null;
  fighters: CombatAvatars;
  onHighlight: (actor: CombatActor | null) => void;
}) {
  const [history, setHistory] = useState(false);
  const turns = combatTimeline(frames, frame, playing, active);
  const completed = playing ? frames.filter((f) => f.seq < (frame?.seq ?? -1)) : frames;
  const recent = completed
    .filter((f) => f.actor)
    .slice(-5)
    .reverse();
  return (
    <aside className="arena-combat-timeline" aria-label="Linha de turnos">
      <div className="combat-timeline-heading">
        <span>ORDEM DE TURNOS</span>
        <b>
          {playing ? "AO VIVO" : active ? `TURNO ${String(active.round).padStart(2, "0")}` : "FIM"}
        </b>
        <button
          aria-label={history ? "Fechar histórico de turnos" : "Abrir histórico de turnos"}
          aria-expanded={history}
          onClick={() => setHistory(!history)}
        >
          {history ? <X size={13} /> : <History size={13} />}
        </button>
      </div>
      <div className="combat-timeline-order">
        {turns.map((turn, i) => (
          <div
            className="combat-turn"
            key={turn.seq ?? turn.actor}
            data-current={
              turn.label === "AGORA" || turn.label === "EFEITO" || (!playing && i === 0 && !!active)
            }
          >
            {i > 0 && <ChevronRight className="combat-turn-arrow" size={13} />}
            <span className="combat-turn-label">{turn.label}</span>
            <CombatAvatar actor={turn.actor} fighters={fighters} onHighlight={onHighlight} />
            <small>{fighters[turn.actor].name}</small>
          </div>
        ))}
        {!turns.length && (
          <span className="timeline-finished">
            {playing ? "Preparando sequência…" : active ? "Escolha seu golpe" : "Combate encerrado"}
          </span>
        )}
      </div>
      <p className="combat-timeline-caption">
        {playing
          ? (frame?.caption ?? "A batalha começou")
          : active?.intent
            ? `${fighters.enemy.name}: ${active.intent.label}`
            : "Passe sobre um avatar para localizar o guerreiro."}
      </p>
      {active && !playing && (
        <small className="timeline-initiative-note">
          Iniciativa da rodada · ações podem incluir defesa e itens
        </small>
      )}
      {history && (
        <div className="combat-timeline-history" aria-label="Histórico de turnos">
          <strong>ÚLTIMOS MOVIMENTOS</strong>
          {recent.map((f) => (
            <div key={f.seq}>
              <CombatAvatar actor={f.actor!} fighters={fighters} onHighlight={onHighlight} />
              <span>
                <small>TURNO {f.round}</small>
                {f.caption}
                {f.kind === "strike" && <b>−{f.damage} HP</b>}
              </span>
            </div>
          ))}
          {!recent.length && <p>O combate está começando. Os movimentos aparecerão aqui.</p>}
        </div>
      )}
    </aside>
  );
}
