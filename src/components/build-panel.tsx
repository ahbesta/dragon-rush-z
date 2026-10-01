"use client";
import { useState } from "react";
import { Crosshair, Minus, Plus, Zap } from "lucide-react";
import type { GameSnapshot } from "@/game/types";
import type { ActionPayload } from "@/game/validation";
import {
  attributeKeys,
  buildAttributes,
  emptyAllocation,
  pointBudget,
  spentPoints,
} from "@/game/builds";
import { deriveBuildStats } from "@/game/attributes";
import { attributeIcons, attributeLabels, formatNumber } from "./game-primitives";

export function BuildPanel({
  snapshot,
  busy,
  onAction,
  onVillage,
}: {
  snapshot: GameSnapshot;
  busy: boolean;
  onAction: (a: ActionPayload) => void;
  onVillage: () => void;
}) {
  const [draft, setDraft] = useState(emptyAllocation);
  const allocated = snapshot.character.allocation ?? emptyAllocation();
  const available =
    pointBudget(snapshot.character.level) - spentPoints(allocated) - spentPoints(draft);
  const preview = buildAttributes(
    snapshot.race,
    Object.fromEntries(attributeKeys.map((k) => [k, allocated[k] + draft[k]])) as typeof allocated,
  );
  const equipped = Object.values(snapshot.character.equipment)
    .map((id) => snapshot.catalog.items.find((i) => i.id === id)!)
    .filter(Boolean);
  const previewStats = deriveBuildStats(preview, snapshot.character.level, equipped);
  return (
    <section className="panel rpg-build" aria-label="Distribuir atributos">
      <div className="section-title">
        <h3>
          <Crosshair size={20} /> Construa seu guerreiro
        </h3>
        <span className="badge orange">{available} pontos livres</span>
      </div>
      <p className="muted">
        Cinco pontos por nível. Sua raça potencializa o investimento; equipamentos somam seus
        próprios bônus.
      </p>
      <div className="rpg-build-rows">
        {attributeKeys.map((key) => {
          const Icon = attributeIcons[key];
          return (
            <div className="rpg-build-row" key={key}>
              <Icon size={21} />
              <div>
                <strong>{attributeLabels[key]}</strong>
                <small>
                  Afinidade ×{snapshot.race.affinities?.[key] ?? 1} · {allocated[key]} pontos
                  investidos
                </small>
              </div>
              <strong className="rpg-stat-preview">
                {snapshot.stats[key] ?? 0}
                {draft[key] > 0 && <span> → {previewStats[key]}</span>}
              </strong>
              <div className="rpg-stepper">
                <button
                  aria-label={`Diminuir ${attributeLabels[key]}`}
                  disabled={busy || draft[key] === 0}
                  onClick={() => setDraft({ ...draft, [key]: draft[key] - 1 })}
                >
                  <Minus size={15} />
                </button>
                <span>{draft[key]}</span>
                <button
                  aria-label={`Aumentar ${attributeLabels[key]}`}
                  disabled={busy || available === 0}
                  onClick={() => setDraft({ ...draft, [key]: draft[key] + 1 })}
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="rpg-build-summary">
        <span>
          <Zap size={16} /> PL previsto: <strong>{formatNumber(previewStats.powerLevel)}</strong>
        </span>
        <span>
          HP {previewStats.maxHp} · Ki {previewStats.maxKi}
        </span>
      </div>
      <div className="rpg-actions">
        <button
          className="button primary"
          disabled={busy || spentPoints(draft) === 0}
          onClick={() => onAction({ action: "attributes.allocate", points: draft })}
        >
          Confirmar atributos
        </button>
        <button className="button secondary" onClick={onVillage}>
          Redistribuir na vila
        </button>
      </div>
    </section>
  );
}
