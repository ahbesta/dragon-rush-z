"use client";
import { Bot, Hand } from "lucide-react";
import type { ActionPayload } from "@/game/validation";
import type { GameSnapshot } from "@/game/types";

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
          {snapshot.activeBattle?.manualOnly
            ? "Vença este desafio manualmente uma vez para liberar o automático contra ele."
            : snapshot.activeBattle
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
