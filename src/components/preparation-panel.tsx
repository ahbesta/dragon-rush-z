"use client";
import { Package, Heart } from "lucide-react";
import type { GameSnapshot } from "@/game/types";
import type { ActionPayload } from "@/game/validation";
import { ItemIcon } from "./game-primitives";
export function PreparationPanel({
  snapshot,
  busy,
  onAction,
}: {
  snapshot: GameSnapshot;
  busy: boolean;
  onAction: (a: ActionPayload) => void;
}) {
  const c = snapshot.character,
    belt = c.belt ?? [],
    auto = c.autoItems ?? { enabled: false, hpThreshold: 30, kiThreshold: 20, maxUses: 1 };
  return (
    <section className="panel rpg-preparation" aria-label="Preparo de combate">
      <div className="section-title">
        <h3>
          <Package size={20} /> Bolsa de combate
        </h3>
        <span className="badge">{belt.length}/3 TIPOS</span>
      </div>
      <p className="muted">
        Leve até três tipos. Usar um item consome a ação; máximo de três usos na luta, com duas
        rodadas de recarga. Uma Semente dos Deuses por batalha.
      </p>
      <div className="rpg-belt-grid">
        {snapshot.catalog.items
          .filter((i) => i.type === "consumable" && !i.effects.outsideOnly)
          .map((i) => {
            const selected = belt.includes(i.id),
              quantity = snapshot.inventory.find((it) => it.itemId === i.id)?.quantity ?? 0;
            return (
              <button
                key={i.id}
                aria-pressed={selected}
                className={selected ? "selected" : ""}
                disabled={busy || (!selected && belt.length === 3)}
                onClick={() =>
                  onAction({
                    action: "belt.select",
                    itemIds: selected ? belt.filter((id) => id !== i.id) : [...belt, i.id],
                  })
                }
              >
                <ItemIcon item={i} />
                <span>
                  <strong>{i.name}</strong>
                  <small>
                    {quantity} na mochila · {selected ? "NA BOLSA" : "Adicionar"}
                  </small>
                </span>
              </button>
            );
          })}
      </div>
      <div className="rpg-auto-items">
        <h4>
          <Heart size={16} /> Poções no farm automático
        </h4>
        <label>
          <input
            type="checkbox"
            disabled={busy}
            checked={auto.enabled}
            onChange={(e) => onAction({ action: "auto.items", ...auto, enabled: e.target.checked })}
          />{" "}
          Autorizar consumo dos itens da bolsa
        </label>
        <div className="rpg-auto-fields">
          <label>
            Usar cura abaixo de
            <select
              value={auto.hpThreshold}
              disabled={busy}
              onChange={(e) =>
                onAction({ action: "auto.items", ...auto, hpThreshold: Number(e.target.value) })
              }
            >
              {[10, 20, 30, 40, 50, 60].map((v) => (
                <option key={v} value={v}>
                  {v}% HP
                </option>
              ))}
            </select>
          </label>
          <label>
            Recuperar Ki abaixo de
            <select
              value={auto.kiThreshold}
              disabled={busy}
              onChange={(e) =>
                onAction({ action: "auto.items", ...auto, kiThreshold: Number(e.target.value) })
              }
            >
              {[10, 20, 30, 40, 50, 60].map((v) => (
                <option key={v} value={v}>
                  {v}% Ki
                </option>
              ))}
            </select>
          </label>
          <label>
            Máximo por combate
            <select
              value={auto.maxUses}
              disabled={busy}
              onChange={(e) =>
                onAction({ action: "auto.items", ...auto, maxUses: Number(e.target.value) })
              }
            >
              {[1, 2, 3].map((v) => (
                <option key={v} value={v}>
                  {v} uso(s)
                </option>
              ))}
            </select>
          </label>
        </div>
        <small>
          Poções são realmente gastas, inclusive em derrotas. Bosses e provas continuam manuais.
        </small>
      </div>
    </section>
  );
}
