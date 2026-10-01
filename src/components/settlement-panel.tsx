"use client";
import { useState } from "react";
import { Hammer, LockKeyhole, Store, Undo2 } from "lucide-react";
import type { GameSnapshot } from "@/game/types";
import type { ActionPayload } from "@/game/validation";
import { unmetRequirements } from "@/game/requirements";
import { respecCost, spentPoints, emptyAllocation } from "@/game/builds";
import { Scene, ItemIcon, ItemEffects } from "./game-primitives";

export function SettlementPanel({
  snapshot,
  busy,
  onAction,
}: {
  snapshot: GameSnapshot;
  busy: boolean;
  onAction: (a: ActionPayload) => void;
}) {
  const [selected, setSelected] = useState("paozu"),
    [tab, setTab] = useState<"shop" | "craft" | "sell">("shop"),
    [confirm, setConfirm] = useState(false);
  const { catalog, character: c } = snapshot;
  const context = {
    level: c.level,
    powerLevel: snapshot.stats.powerLevel,
    raceId: c.raceId,
    flags: c.flags,
  };
  const village = catalog.settlements.find((v) => v.id === selected) ?? catalog.settlements[0];
  const reasons = unmetRequirements(village.requirements, context),
    cost = respecCost(c.level, c.respecCount ?? 0);
  const owned = (id: string) => snapshot.inventory.find((i) => i.itemId === id)?.quantity ?? 0;
  return (
    <div className="rpg-settlements">
      <div className="rpg-heading">
        <span className="eyebrow orange">SUPRIMENTOS · TROCAS · FABRICAÇÃO</span>
        <h2>
          <Store size={27} /> Vilas e serviços
        </h2>
        <p>Transforme seus materiais em preparo para o próximo desafio.</p>
      </div>
      <div className="rpg-village-selector">
        {catalog.settlements.map((v) => (
          <button
            key={v.id}
            className={selected === v.id ? "selected" : ""}
            onClick={() => {
              setSelected(v.id);
              setConfirm(false);
            }}
          >
            {unmetRequirements(v.requirements, context).length > 0 ? (
              <LockKeyhole size={16} />
            ) : (
              <Store size={16} />
            )}{" "}
            {v.name}
          </button>
        ))}
      </div>
      <section className="panel rpg-village-hero">
        <Scene kind={village.art} />
        <div>
          <span className="eyebrow">{village.npc}</span>
          <h3>{village.name}</h3>
          <p>{village.description}</p>
          {reasons.length > 0 && <small>Requisitos: {reasons.join(" · ")}</small>}
        </div>
      </section>
      {reasons.length === 0 && (
        <>
          <div className="rpg-tabs" role="group" aria-label="Serviços da vila">
            {(
              [
                ["shop", "Comprar"],
                ["craft", "Fabricar e trocar"],
                ["sell", "Vender"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} className={tab === id ? "selected" : ""} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
          <div className="rpg-market-grid">
            {tab === "shop" &&
              catalog.offers
                .filter((o) => o.settlementId === village.id)
                .map((o) => {
                  const item = catalog.items.find((i) => i.id === o.itemId)!;
                  const locked = [
                    ...new Set([
                      ...unmetRequirements(o.requirements, context),
                      ...unmetRequirements(item.requirements, context),
                    ]),
                  ];
                  return (
                    <article className="panel rpg-item-card" key={o.id}>
                      <ItemIcon item={item} showcase />
                      <div>
                        <span className={`badge rarity-${item.rarity}`}>
                          {item.rarity.toUpperCase()}
                        </span>
                        <h4>{item.name}</h4>
                        <p>{item.description}</p>
                        <ItemEffects item={item} />
                        <small>Na mochila: {owned(item.id)}</small>
                      </div>
                      <button
                        className="button primary small"
                        disabled={busy || c.zeni < o.price || locked.length > 0}
                        onClick={() => onAction({ action: "shop.buy", offerId: o.id, quantity: 1 })}
                      >
                        Comprar · {o.price} Zeni
                      </button>
                      {locked.length > 0 && <small>{locked.join(" · ")}</small>}
                    </article>
                  );
                })}
            {tab === "craft" &&
              catalog.recipes
                .filter((r) => r.settlementId === village.id)
                .map((r) => {
                  const item = catalog.items.find((i) => i.id === r.outputItemId)!;
                  const locked = [
                    ...new Set([
                      ...unmetRequirements(r.requirements, context),
                      ...unmetRequirements(item.requirements, context),
                    ]),
                  ];
                  const enough =
                    r.ingredients.every((i) => owned(i.itemId) >= i.quantity) &&
                    c.zeni >= r.zeniCost;
                  return (
                    <article className="panel rpg-item-card" key={r.id}>
                      <ItemIcon item={item} showcase />
                      <div>
                        <span className="eyebrow">
                          <Hammer size={13} /> RECEITA OU TROCA
                        </span>
                        <h4>{item.name}</h4>
                        <ItemEffects item={item} />
                        <ul className="rpg-ingredients">
                          {r.ingredients.map((i) => (
                            <li
                              key={i.itemId}
                              className={owned(i.itemId) >= i.quantity ? "green-text" : ""}
                            >
                              {catalog.items.find((it) => it.id === i.itemId)?.name}:{" "}
                              {owned(i.itemId)}/{i.quantity}
                            </li>
                          ))}
                        </ul>
                        {r.zeniCost > 0 && <small>+ {r.zeniCost} Zeni</small>}
                      </div>
                      <button
                        className="button primary small"
                        disabled={busy || !enough || locked.length > 0}
                        onClick={() =>
                          onAction({ action: "recipe.craft", recipeId: r.id, quantity: 1 })
                        }
                      >
                        {r.id.startsWith("troca-") ? "Trocar troféus" : "Fabricar"}
                      </button>
                      {locked.length > 0 && <small>{locked.join(" · ")}</small>}
                    </article>
                  );
                })}
            {tab === "sell" &&
              snapshot.inventory
                .filter((i) => i.quantity > 0)
                .map((i) => {
                  const item = catalog.items.find((it) => it.id === i.itemId)!;
                  const equipped = Object.values(c.equipment).includes(i.itemId);
                  return (
                    <article className="panel rpg-item-card" key={i.itemId}>
                      <ItemIcon item={item} />
                      <div>
                        <h4>
                          {item.name} ×{i.quantity}
                        </h4>
                        <p>
                          {equipped
                            ? "A unidade equipada é preservada; venda apenas duplicatas."
                            : item.description}
                        </p>
                      </div>
                      <button
                        className="button secondary small"
                        disabled={busy || !item.sellPrice || (equipped && i.quantity <= 1)}
                        onClick={() =>
                          onAction({
                            action: "shop.sell",
                            settlementId: village.id,
                            itemId: item.id,
                            quantity: 1,
                          })
                        }
                      >
                        Vender 1 · {item.sellPrice ?? 0} Zeni
                      </button>
                    </article>
                  );
                })}
          </div>
          <section className="panel rpg-respec">
            <div>
              <h3>
                <Undo2 size={20} /> Redistribuir atributos
              </h3>
              <p>
                {cost === 0
                  ? "Sua primeira redistribuição é gratuita."
                  : `Custo desta redistribuição: ${cost} Zeni.`}{" "}
                Os pontos voltarão a ficar disponíveis. Seus recursos atuais não serão restaurados.
              </p>
            </div>
            <button
              className="button secondary"
              disabled={
                busy || c.zeni < cost || spentPoints(c.allocation ?? emptyAllocation()) === 0
              }
              onClick={() =>
                confirm
                  ? onAction({ action: "attributes.respec", settlementId: village.id })
                  : setConfirm(true)
              }
            >
              {confirm ? "Confirmar redistribuição" : "Redistribuir"}
            </button>
            {confirm && (
              <button className="text-button" onClick={() => setConfirm(false)}>
                Cancelar
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
