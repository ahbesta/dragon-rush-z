"use client";
import { useState } from "react";
import {
  Compass,
  Route,
  BookOpen,
  TriangleAlert,
  LockKeyhole,
  ArrowRight,
  Package,
  Heart,
  Map,
} from "lucide-react";
import type { GameSnapshot } from "@/game/types";
import type { ActionPayload } from "@/game/validation";
import type { ExplorationCategory, ExplorationReward } from "@/game/exploration/types";
import { unmetRequirements } from "@/game/requirements";
import { RegionSelector } from "./region-selector";
import { Scene, ItemIcon, attributeLabels } from "./game-primitives";
import { BattleLootReveal, rarityNames } from "./battle-loot-reveal";
import { sortItemsByRarity } from "@/lib/item-presentation";
import { ArtworkImage } from "./artwork-image";
import { explorationWeightsForRoute } from "@/game/exploration/rules";

const categoryLabels: Record<ExplorationCategory, string> = {
  gather: "COLETA",
  npc: "ENCONTRO",
  danger: "PERIGO",
  treasure: "TESOURO",
  discovery: "DESCOBERTA",
  exceptional: "SINAL EXCEPCIONAL",
};
function Finds({
  reward,
  snapshot,
  pending = false,
}: {
  reward: ExplorationReward;
  snapshot: GameSnapshot;
  pending?: boolean;
}) {
  return (
    <div
      className="exploration-finds"
      aria-label={pending ? "Achados pendentes" : "Recompensas guardadas"}
    >
      <span>
        <Package size={16} />
        {pending ? "ACHADOS PENDENTES · AINDA EM RISCO" : "GUARDADO NA MOCHILA"}
      </span>
      {sortItemsByRarity(reward.items, snapshot.catalog.items).map((drop) => {
        const item = snapshot.catalog.items.find((i) => i.id === drop.itemId);
        return (
          <div key={drop.itemId} className={`exploration-find rarity-${item?.rarity ?? "common"}`}>
            <ItemIcon item={item} />
            <strong>
              {item?.name} <small>×{drop.quantity}</small>
            </strong>
          </div>
        );
      })}
      {reward.zeni > 0 && <strong>◈ {reward.zeni} Zeni</strong>}
      {reward.xp > 0 && <strong>+{reward.xp} XP</strong>}
      {reward.flags.length > 0 && (
        <strong>
          <Map size={16} /> {reward.flags.length} descoberta(s) permanente(s)
        </strong>
      )}
      {!reward.items.length && !reward.zeni && !reward.xp && !reward.flags.length && (
        <small>Nenhum achado.</small>
      )}
    </div>
  );
}
export function ExplorationPanel({
  snapshot,
  areaId,
  onArea,
  busy,
  now,
  onAction,
  revealId,
  onPresentationComplete,
}: {
  snapshot: GameSnapshot;
  areaId: string;
  onArea: (id: string) => void;
  busy: boolean;
  now: number;
  onAction: (action: ActionPayload) => void;
  revealId: string | null;
  onPresentationComplete: (id: string) => void;
}) {
  const [routeId, setRouteId] = useState("");
  const encounter = snapshot.activeExploration,
    result = snapshot.latestExploration;
  const area =
    snapshot.catalog.areas.find((a) => a.id === (encounter?.areaId ?? areaId)) ??
    snapshot.catalog.areas[0];
  const routes = (snapshot.catalog.explorationRoutes ?? []).filter((r) => r.areaId === area.id);
  const chosenRoute = routes.find(
    (r) => r.id === routeId && snapshot.character.flags.includes(r.discoveryFlag),
  );
  const reasons = unmetRequirements(
    { ...area.requirements, minLevel: area.minLevel },
    { ...snapshot.character, powerLevel: snapshot.stats.powerLevel },
  );
  const cooldown = Math.max(
    0,
    Math.ceil((new Date(snapshot.explorationCooldownAt ?? 0).getTime() - now) / 1000),
  );
  const battleCooldown = Math.max(
    0,
    Math.ceil((new Date(snapshot.character.nextBattleAt ?? 0).getTime() - now) / 1000),
  );
  const wait = Math.max(cooldown, battleCooldown);
  const consumePotion = (itemId: string) => onAction({ action: "item.use", itemId });
  const potions = snapshot.inventory.filter(
    (o) =>
      o.quantity > 0 &&
      snapshot.catalog.items.some(
        (i) =>
          i.id === o.itemId &&
          i.type === "consumable" &&
          (i.effects.restoreHp || i.effects.restoreKi),
      ),
  );
  return (
    <section className="exploration-panel" aria-label="Exploração da Terra">
      {!encounter && (
        <RegionSelector snapshot={snapshot} areaId={areaId} onArea={onArea} exploration />
      )}
      {encounter ? (
        <article className={`exploration-occurrence occurrence-${encounter.category}`}>
          <div className="exploration-illustration">
            <Scene kind={area.id} />
            {encounter.npcId ? (
              <ArtworkImage
                art={{
                  src: `/images/exploration/${encounter.npcId}.webp`,
                  alt: encounter.npcName ?? "Viajante",
                  width: 512,
                  height: 512,
                }}
                sizes="(max-width:760px) 240px,360px"
                className="exploration-npc-art"
              />
            ) : encounter.category === "treasure" && area.id === "floresta" ? (
              <ArtworkImage
                art={{
                  src: "/images/exploration/encounter.webp",
                  alt: "Baú, cápsula e ervas em uma gruta do Monte Paozu",
                  width: 1200,
                  height: 800,
                }}
                sizes="(max-width:760px) 600px,400px"
                className="exploration-event-art"
              />
            ) : (
              <div className="exploration-prop-art">
                <ItemIcon
                  showcase
                  item={snapshot.catalog.items.find(
                    (i) =>
                      i.id ===
                      (encounter.category === "discovery"
                        ? `mapa-${area.id}`
                        : encounter.category === "exceptional"
                          ? `reliquia-${area.id}`
                          : encounter.category === "gather"
                            ? ((
                                {
                                  floresta: "erva",
                                  montanhas: "fruto-ki",
                                  deserto: "sucata",
                                } as Record<string, string>
                              )[area.id] ?? "componente")
                            : "kit-exploracao"),
                  )}
                />
              </div>
            )}
            <div className="exploration-event-symbol" aria-hidden="true">
              {encounter.category === "npc" ? (
                <BookOpen />
              ) : encounter.category === "danger" ? (
                <TriangleAlert />
              ) : encounter.category === "discovery" ? (
                <Route />
              ) : encounter.category === "treasure" ? (
                <Package />
              ) : (
                <Compass />
              )}
            </div>
            <span className="exploration-stamp">
              {categoryLabels[encounter.category]} · {rarityNames[encounter.rarity]}
            </span>
          </div>
          <div className="exploration-story">
            <span className="eyebrow orange">
              {area.name} ·{" "}
              {encounter.stageId === "deeper" ? "ETAPA 2 DE 2" : "ENCONTRO EM ANDAMENTO"}
            </span>
            <h2>{encounter.title}</h2>
            <p>{encounter.description}</p>
            {encounter.message && (
              <p className="exploration-consequence" role="status">
                {encounter.message}
              </p>
            )}
            {encounter.stageId !== "arrival" && (
              <>
                <h3>{encounter.stageTitle}</h3>
                <p>{encounter.stageText}</p>
              </>
            )}
            {encounter.status === "battle" ? (
              <p className="exploration-risk">
                <TriangleAlert size={18} /> A emboscada continua na arena abaixo. Vencer guarda os
                achados; uma derrota os perde.
              </p>
            ) : (
              <div className="exploration-choices">
                {encounter.choices.map((choice) => (
                  <button
                    key={choice.id}
                    className="exploration-choice"
                    disabled={busy || Boolean(choice.reasons.length)}
                    onClick={() =>
                      onAction({
                        action: "exploration.choose",
                        encounterId: encounter.id,
                        revision: encounter.revision,
                        choiceId: choice.id,
                      })
                    }
                  >
                    <div>
                      <strong>{choice.label}</strong>
                      <span className={choice.chance < 100 ? "chance-tested" : "chance-safe"}>
                        {choice.chance}%
                        {choice.check
                          ? ` · ${attributeLabels[choice.check.attribute]}`
                          : " · GARANTIDO"}
                      </span>
                    </div>
                    <p>{choice.description}</p>
                    <small>
                      <TriangleAlert size={13} />
                      {choice.risk}
                    </small>
                    <div className="exploration-choice-cost">
                      {choice.cost?.ki ? <span>{choice.cost.ki} Ki</span> : null}
                      {choice.cost?.zeni ? <span>◈ {choice.cost.zeni} Zeni</span> : null}
                      {choice.cost?.items?.map((c) => (
                        <span key={c.itemId}>
                          {c.quantity}×{" "}
                          {snapshot.catalog.items.find((i) => i.id === c.itemId)?.name}
                        </span>
                      ))}
                      {!choice.cost && <span>Sem custo</span>}
                    </div>
                    {choice.reasons.length > 0 && (
                      <em>
                        <LockKeyhole size={13} />
                        {choice.reasons.join(" · ")}
                      </em>
                    )}
                    <ArrowRight className="choice-arrow" size={18} />
                  </button>
                ))}
              </div>
            )}
            <Finds reward={encounter.pending} snapshot={snapshot} pending />
            {encounter.status === "active" && (
              <div className="exploration-supplies">
                <span>
                  <Heart size={16} /> Provisões
                </span>
                {potions.map((o) => (
                  <button
                    className="button secondary small"
                    key={o.itemId}
                    disabled={busy}
                    onClick={() => consumePotion(o.itemId)}
                  >
                    <ItemIcon item={snapshot.catalog.items.find((i) => i.id === o.itemId)} />
                    {snapshot.catalog.items.find((i) => i.id === o.itemId)?.name} ×{o.quantity}
                  </button>
                ))}
                <button
                  className="button danger small"
                  disabled={busy}
                  onClick={() =>
                    onAction({
                      action: "exploration.abandon",
                      encounterId: encounter.id,
                      revision: encounter.revision,
                    })
                  }
                >
                  Abandonar · perder achados
                </button>
              </div>
            )}
          </div>
        </article>
      ) : (
        <article className="panel exploration-departure">
          <div>
            <span className="eyebrow orange">DESCOBRIR É ASSUMIR RISCOS</span>
            <h2>O que existe além da trilha?</h2>
            <p>
              Materiais, encontros, tesouros e caminhos escondidos. Cada saída abre um encontro;
              suas escolhas decidem o que volta na mochila.
            </p>
          </div>
          <label>
            Seu caminho
            <select
              aria-label="Caminho de exploração"
              value={chosenRoute?.id ?? ""}
              disabled={busy}
              onChange={(e) => setRouteId(e.target.value)}
            >
              <option value="">Trilha principal</option>
              {routes.map((route) => (
                <option
                  key={route.id}
                  value={route.id}
                  disabled={!snapshot.character.flags.includes(route.discoveryFlag)}
                >
                  {route.name}
                  {snapshot.character.flags.includes(route.discoveryFlag)
                    ? ""
                    : " · NÃO DESCOBERTO"}
                </option>
              ))}
            </select>
          </label>
          {chosenRoute && <p>{chosenRoute.description}</p>}
          <button
            className="button primary"
            disabled={
              busy ||
              wait > 0 ||
              snapshot.character.hp <= 0 ||
              reasons.length > 0 ||
              Boolean(snapshot.activity)
            }
            onClick={() =>
              onAction({
                action: "exploration.start",
                areaId: area.id,
                ...(chosenRoute ? { routeId: chosenRoute.id } : {}),
              })
            }
          >
            <Compass size={20} />
            {wait ? `Próximo encontro em ${wait}s` : "Procurar um encontro"}
          </button>
          {reasons.length > 0 && (
            <p>
              <LockKeyhole size={15} />
              {reasons.join(" · ")}
            </p>
          )}
          {snapshot.character.hp <= 0 && <p>Recupere seu HP antes de explorar.</p>}
          <div className="exploration-odds">
            {Object.entries(explorationWeightsForRoute(chosenRoute)).map(([category, weight]) => (
              <span key={category}>
                {weight.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%{" "}
                {categoryLabels[category as ExplorationCategory].toLocaleLowerCase("pt-BR")}
              </span>
            ))}
          </div>
          <p className="exploration-risk">
            <TriangleAlert size={16} /> Falhas podem ser fatais e perder os achados deste encontro.
            Itens anteriores estão protegidos. Coletas repetidas não dão XP.
          </p>
        </article>
      )}
      {!encounter && result && (
        <article
          className={`panel exploration-resolution resolution-${result.status}`}
          aria-label="Resultado da exploração"
        >
          <span className="eyebrow">
            {result.status === "success"
              ? "ENCONTRO CONCLUÍDO"
              : result.status === "failed"
                ? "ENCONTRO FRACASSADO"
                : "ENCONTRO ABANDONADO"}
          </span>
          <h3>{result.title}</h3>
          <p>{result.message}</p>
          <Finds reward={result.rewards} snapshot={snapshot} />
          {result.lost.items.length > 0 && (
            <p className="exploration-risk">
              Perdidos:{" "}
              {result.lost.items
                .map(
                  (i) =>
                    `${snapshot.catalog.items.find((x) => x.id === i.itemId)?.name} ×${i.quantity}`,
                )
                .join(" · ")}
            </p>
          )}
          <details>
            <summary>Diário deste encontro</summary>
            {result.log.map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </details>
          {(!result.battleId || result.battleId !== snapshot.latestBattle?.id) && (
            <BattleLootReveal
              key={result.id}
              battle={{ id: result.id, drops: result.rewards.items }}
              items={snapshot.catalog.items}
              enabled
              reveal={revealId === result.id}
              onComplete={() => onPresentationComplete(result.id)}
            />
          )}
        </article>
      )}
      <details className="panel exploration-journal">
        <summary>
          <BookOpen size={20} /> Diário de descobertas ·{" "}
          {snapshot.character.flags.filter((f) => f.startsWith("discovery:")).length} registros
        </summary>
        <div className="exploration-journal-grid">
          {snapshot.catalog.areas.map((a) => {
            const route = snapshot.catalog.explorationRoutes?.find((r) => r.areaId === a.id);
            return (
              <div key={a.id}>
                <strong>{a.name}</strong>
                <span>
                  {route && snapshot.character.flags.includes(route.discoveryFlag)
                    ? `✓ ${route.name}`
                    : "? Caminho desconhecido"}
                </span>
                <span>
                  {snapshot.character.flags.includes(`discovery:${a.id}:npc`)
                    ? "✓ Receita do mapa aprendida"
                    : "? Contato regional"}
                </span>
                <span>
                  {snapshot.character.flags.includes(`discovery:${a.id}:relic`)
                    ? "✓ Insígnia recuperada"
                    : "? Equipamento exclusivo"}
                </span>
              </div>
            );
          })}
        </div>
      </details>
    </section>
  );
}
