"use client";
import { useState } from "react";
import { Flame, Swords } from "lucide-react";
import type { EnemyDefinition, GameSnapshot } from "@/game/types";
import type { ActionPayload } from "@/game/validation";
import { unmetRequirements } from "@/game/requirements";
import { EnemyPortrait } from "./enemy-portrait";
export function EnemyDrops({
  enemy,
  snapshot,
}: {
  enemy: EnemyDefinition;
  snapshot: GameSnapshot;
}) {
  const { catalog } = snapshot;
  return (
    <details className="rpg-drops">
      <summary>Consultar drops e comportamento</summary>
      <p>{enemy.pattern?.map((p) => p.label).join(" → ")}</p>
      {enemy.guaranteedItem && (
        <p className="green-text">
          Garantido: 1 {catalog.items.find((i) => i.id === enemy.guaranteedItem)?.name}
        </p>
      )}
      <ul>
        {catalog.drops
          .filter((d) => d.enemyId === enemy.id)
          .map((d) => (
            <li key={d.itemId}>
              <span>{catalog.items.find((i) => i.id === d.itemId)?.name}</span>
              <strong>{Math.round(d.chance * 10000) / 100}%</strong>
            </li>
          ))}
      </ul>
      <small>
        As chances são independentes. Equipamentos raros de boss também podem ser obtidos com 15
        troféus nas vilas.
      </small>
    </details>
  );
}
export function HeroicPanel({
  snapshot,
  busy,
  onAction,
}: {
  snapshot: GameSnapshot;
  busy: boolean;
  onAction: (a: ActionPayload) => void;
}) {
  const [show, setShow] = useState(false),
    { catalog, character: c } = snapshot;
  const available = catalog.enemies.filter(
    (e) => e.heroicOf && c.flags.includes(`defeated:${e.heroicOf}`),
  );
  if (!available.length) return null;
  return (
    <section className="panel rpg-heroics">
      <div className="section-title">
        <h3>
          <Flame size={20} /> Desafios Heróicos
        </h3>
        <button className="text-button" onClick={() => setShow(!show)}>
          {show ? "Recolher" : "Ver desafios"}
        </button>
      </div>
      <p className="muted">
        Reencontre os bosses vencidos, com poder e padrões próprios. Dificuldade fixa; troféus
        garantidos e drops melhores.
      </p>
      {show && (
        <div className="rpg-market-grid">
          {available.map((e) => {
            const reasons = unmetRequirements(e.requirements, {
              level: c.level,
              powerLevel: snapshot.stats.powerLevel,
              raceId: c.raceId,
              flags: c.flags,
            });
            return (
              <article className="rpg-heroic-card" key={e.id}>
                <EnemyPortrait enemyId={e.id} artId={e.artId} />
                <h4>{e.name}</h4>
                <p>
                  Nível {e.level} · {e.maxHp} HP · {e.zeniReward} Zeni
                </p>
                <EnemyDrops enemy={e} snapshot={snapshot} />
                <button
                  className="button primary small"
                  disabled={busy || reasons.length > 0 || c.hp <= 0}
                  onClick={() => onAction({ action: "boss", enemyId: e.id })}
                >
                  <Swords size={15} /> {reasons.length ? reasons.join(" · ") : "Desafiar · manual"}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
