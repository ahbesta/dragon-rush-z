"use client";
import { useState } from "react";
import {
  Compass,
  Route,
  BookOpen,
  TriangleAlert,
  LockKeyhole,
  Package,
  Heart,
  Map,
  Zap,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import type { GameSnapshot } from "@/game/types";
import type { ActionPayload } from "@/game/validation";
import type { ExplorationCategory, ExplorationReward } from "@/game/exploration/types";
import { unmetRequirements } from "@/game/requirements";
import { ExplorationDecision, ExplorationFeedbackCard } from "./exploration-feedback";
import { RegionSelector } from "./region-selector";
import { Scene, ItemIcon } from "./game-primitives";
import { BattleLootReveal, rarityNames } from "./battle-loot-reveal";
import { sortItemsByRarity } from "@/lib/item-presentation";
import { ArtworkImage } from "./artwork-image";
import { explorationWeightsForRoute } from "@/game/exploration/rules";
import { enemyArtwork } from "@/lib/game-art";
import { DragonBall } from "./brand";

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
  combatPresentation = false,
}: {
  snapshot: GameSnapshot;
  areaId: string;
  onArea: (id: string) => void;
  busy: boolean;
  now: number;
  onAction: (action: ActionPayload) => void;
  revealId: string | null;
  onPresentationComplete: (id: string) => void;
  combatPresentation?: boolean;
}) {
  const [routeId, setRouteId] = useState("");
  const [dismissedResult, setDismissedResult] = useState<string | null>(null);
  const encounter = snapshot.activeExploration,
    result = snapshot.latestExploration;
  const showResult = !encounter && result && result.id !== dismissedResult;
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
  const ambusherArt = encounter?.enemy ? enemyArtwork[encounter.enemy.id] : undefined;
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
  if (combatPresentation && encounter)
    return (
      <div className="exploration-battle-status">
        <Compass size={18} />
        <strong>
          {area.name} · Trecho {encounter.depth}/{encounter.maxDepth}
        </strong>
        <span>
          <Package size={15} />
          {encounter.pending.items.reduce((sum, item) => sum + item.quantity, 0)} achados · EM RISCO
        </span>
      </div>
    );
  return (
    <section className="exploration-panel" aria-label="Exploração da Terra">
      {!encounter && !showResult && (
        <RegionSelector snapshot={snapshot} areaId={areaId} onArea={onArea} exploration />
      )}
      {encounter && (
        <div className="expedition-progress" aria-label="Progresso da expedição">
          <div>
            <Compass size={24} />
            <span>
              EXPEDIÇÃO EM CURSO
              <strong>
                Trecho {encounter.depth} de {encounter.maxDepth}
              </strong>
            </span>
            <span className={encounter.depth > 2 ? "threat-critical" : "threat-cautious"}>
              {
                ["", "TRILHA INICIAL", "ATENÇÃO", "PERIGOSO", "MUITO PERIGOSO", "RISCO EXTREMO"][
                  encounter.depth
                ]
              }
            </span>
          </div>
          <ol>
            {Array.from({ length: encounter.maxDepth }, (_, index) => (
              <li
                key={index}
                className={
                  index + 1 === encounter.depth
                    ? "current"
                    : index + 1 < encounter.depth
                      ? "passed"
                      : ""
                }
                aria-current={index + 1 === encounter.depth ? "step" : undefined}
              >
                <DragonBall stars={index + 1} />
                <small>
                  {index === 0
                    ? "PARTIDA"
                    : index === encounter.maxDepth - 1
                      ? "LIMITE"
                      : `TRECHO ${index + 1}`}
                </small>
              </li>
            ))}
          </ol>
          <div className="expedition-warning-strip">
            <span>
              <TriangleAlert size={14} />
              PERIGO ↑
            </span>
            <span>
              <Zap size={14} />
              INIMIGOS ↑
            </span>
            <span>
              <TrendingUp size={14} />
              RECOMPENSA ↑
            </span>
          </div>
          <small className="expedition-bank-warning">Achados em risco até voltar.</small>
        </div>
      )}
      {encounter ? (
        <article className={`exploration-occurrence occurrence-${encounter.category}`}>
          <div className="exploration-illustration">
            <Scene kind={area.id} />
            {encounter.status === "ambush" && ambusherArt ? (
              <ArtworkImage
                art={ambusherArt}
                sizes="(max-width:760px) 240px,360px"
                className="exploration-npc-art"
              />
            ) : encounter.npcId ? (
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
              {encounter.status === "ambush"
                ? "EMBOSCADA · PASSAGEM BLOQUEADA"
                : `${categoryLabels[encounter.category]} · ${rarityNames[encounter.rarity]}`}
            </span>
          </div>
          <div className="exploration-story">
            <span className="eyebrow orange">
              {area.name} ·{" "}
              {encounter.stageId === "deeper"
                ? "ETAPA 2 DE 2 · MESMO TRECHO"
                : "ENCONTRO EM ANDAMENTO"}
            </span>
            <h2>{encounter.status === "ambush" ? "Emboscada na trilha!" : encounter.title}</h2>
            <p>{encounter.description}</p>
            {encounter.feedback && encounter.status !== "ambush" && (
              <ExplorationFeedbackCard
                key={`feedback-${encounter.feedback.id}`}
                feedback={encounter.feedback}
                snapshot={snapshot}
                reveal={revealId === encounter.feedback.id}
                onComplete={() => onPresentationComplete(encounter.feedback!.id)}
              />
            )}
            {encounter.status === "active" && encounter.stageId !== "arrival" && (
              <span className="expedition-stage-caption">
                Ainda neste trecho · vasculhar ou voltar
              </span>
            )}
            {encounter.status === "ambush" ? (
              <div className="expedition-ambush" role="alert">
                <span className="eyebrow">PASSAGEM BLOQUEADA · EMBOSCADA</span>
                <h3>{encounter.enemy?.name ?? "Um inimigo"} encontrou você!</h3>
                {!!encounter.feedback?.kiSpent && (
                  <p className="ambush-ki-spent">
                    Passagem falhou · −{encounter.feedback.kiSpent} Ki
                  </p>
                )}
                <p>Você foi detectado. Vença para liberar o caminho.</p>
                <div className="ambush-stats">
                  <strong>Nível {encounter.enemy?.level}</strong>
                  <strong>{encounter.enemy?.maxHp} HP</strong>
                  <strong>
                    Trecho {encounter.depth} · inimigo{" "}
                    {encounter.depth === 1 ? "da região" : "fortalecido"}
                  </strong>
                </div>
                <div className="ambush-consequences">
                  <span>
                    <ShieldCheck size={18} />
                    <strong>VENCER</strong> Achados preservados
                  </span>
                  <span>
                    <TriangleAlert size={18} />
                    <strong>PERDER</strong> Todos os achados perdidos
                  </span>
                </div>
                <details className="rpg-more-info">
                  <summary>Penalidades da emboscada</summary>
                  <p>
                    Derrota: −{encounter.defeatZeni} Zeni da carteira. Empate também perde os
                    achados. Provisões usadas são gastas. Vitória mantém tudo pendente até o
                    retorno.
                  </p>
                </details>
                <button
                  className="button danger"
                  disabled={busy || snapshot.character.hp <= 0}
                  onClick={() =>
                    onAction({
                      action: "exploration.fight",
                      encounterId: encounter.id,
                      revision: encounter.revision,
                    })
                  }
                >
                  Enfrentar emboscada
                </button>
              </div>
            ) : encounter.status === "battle" ? (
              <p className="exploration-risk">
                <TriangleAlert size={18} /> A emboscada está na arena abaixo. Os achados de todos os
                trechos continuam em risco até o retorno.
              </p>
            ) : encounter.status === "checkpoint" ? (
              <div className="expedition-checkpoint">
                <span className="eyebrow">TRECHO CONCLUÍDO · DECIDA SEU PRÓXIMO PASSO</span>
                <h3>
                  {encounter.depth < encounter.maxDepth ? "Continuar ou voltar?" : "Fim da trilha!"}
                </h3>
                <span className="expedition-bank-warning">
                  Voltar guarda tudo. Continuar arrisca tudo.
                </span>
                {encounter.depth < encounter.maxDepth && (
                  <details className="expedition-escalation">
                    <summary>
                      <TriangleAlert size={16} /> PRÓXIMO TRECHO · MAIS PERIGOSO{" "}
                      <span>Ver riscos</span>
                    </summary>
                    <TriangleAlert size={20} />
                    <div>
                      <strong>PRÓXIMO TRECHO: MAIS PERIGOSO</strong>
                      <span>
                        Perigos: {Math.round(encounter.threat.dangerChance)}% →{" "}
                        {Math.round(encounter.nextThreat.dangerChance)}%
                      </span>
                      <span>
                        Testes: +{Math.round((encounter.nextThreat.targetMultiplier - 1) * 100)}% de
                        dificuldade desde a partida
                      </span>
                      <span>
                        Inimigos: +{Math.round((encounter.nextThreat.enemyHpMultiplier - 1) * 100)}%
                        HP / +
                        {Math.round((encounter.nextThreat.enemyAttributeMultiplier - 1) * 100)}%
                        atributos
                      </span>
                      <span>
                        Travessia: −{encounter.advanceCost} Ki · {snapshot.character.ki} →{" "}
                        {Math.max(0, snapshot.character.ki - encounter.advanceCost)} Ki
                      </span>
                    </div>
                  </details>
                )}
                <div className="checkpoint-actions">
                  <button
                    className="button primary"
                    aria-label="Voltar em segurança"
                    disabled={busy}
                    onClick={() =>
                      onAction({
                        action: "exploration.return",
                        encounterId: encounter.id,
                        revision: encounter.revision,
                      })
                    }
                  >
                    <Package size={18} />
                    VOLTAR · guardar achados
                  </button>
                  {encounter.depth < encounter.maxDepth && (
                    <button
                      className="button danger"
                      aria-label={
                        battleCooldown > 0
                          ? "Recuperando fôlego · " + battleCooldown + "s"
                          : "Avançar ao trecho " +
                            (encounter.depth + 1) +
                            " · −" +
                            encounter.advanceCost +
                            " Ki"
                      }
                      disabled={
                        busy ||
                        snapshot.character.ki < encounter.advanceCost ||
                        battleCooldown > 0 ||
                        snapshot.character.hp <= 0
                      }
                      onClick={() =>
                        onAction({
                          action: "exploration.advance",
                          encounterId: encounter.id,
                          revision: encounter.revision,
                        })
                      }
                    >
                      <Route size={18} />
                      {battleCooldown > 0
                        ? "Recuperando fôlego · " + battleCooldown + "s"
                        : "CONTINUAR · −" + encounter.advanceCost + " KI"}
                    </button>
                  )}
                </div>
                {encounter.depth < encounter.maxDepth &&
                  snapshot.character.ki < encounter.advanceCost && (
                    <p className="exploration-risk">
                      Ki insuficiente. Use uma provisão ou volte em segurança.
                    </p>
                  )}
              </div>
            ) : (
              <div className="exploration-choices">
                {encounter.choices.map((choice) => (
                  <ExplorationDecision
                    key={choice.id}
                    choice={choice}
                    snapshot={snapshot}
                    busy={busy}
                    onChoose={() =>
                      onAction({
                        action: "exploration.choose",
                        encounterId: encounter.id,
                        revision: encounter.revision,
                        choiceId: choice.id,
                      })
                    }
                  />
                ))}
              </div>
            )}
            {encounter.status === "checkpoint" ? (
              <Finds reward={encounter.pending} snapshot={snapshot} pending />
            ) : (
              <details className="expedition-satchel">
                <summary>
                  <Package size={18} /> Achados ·{" "}
                  {encounter.pending.items.reduce((sum, item) => sum + item.quantity, 0)} itens{" "}
                  {encounter.pending.zeni ? "· ◈ " + encounter.pending.zeni : ""}
                  <span>EM RISCO</span>
                </summary>
                <Finds reward={encounter.pending} snapshot={snapshot} pending />
              </details>
            )}
            {encounter.status !== "battle" && (
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
                {encounter.status !== "ambush" && (
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
                )}
              </div>
            )}
            {encounter.feedback?.gained.items.length && !encounter.battleId ? (
              <BattleLootReveal
                key={`loot-${encounter.feedback.id}`}
                battle={{ id: encounter.feedback.id, drops: encounter.feedback.gained.items }}
                items={snapshot.catalog.items}
                enabled
                reveal={revealId === encounter.feedback.id}
                pending
                onComplete={() => onPresentationComplete(encounter.feedback!.id)}
              />
            ) : null}
          </div>
        </article>
      ) : !showResult ? (
        <article className="panel exploration-departure">
          <div>
            <span className="eyebrow orange">DESCOBRIR É ASSUMIR RISCOS</span>
            <h2>O que existe além da trilha?</h2>
            <p>Cinco trechos. Mais perigo. Mais achados. Você decide quando voltar.</p>
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
          <details className="rpg-more-info departure-details">
            <summary>Encontros e riscos</summary>
            <div className="exploration-odds">
              {Object.entries(explorationWeightsForRoute(chosenRoute)).map(([category, weight]) => (
                <span key={category}>
                  {weight.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%{" "}
                  {categoryLabels[category as ExplorationCategory].toLocaleLowerCase("pt-BR")}
                </span>
              ))}
            </div>
            <p>
              Falhas podem ser fatais. Achados de todos os trechos ficam em risco; itens anteriores
              estão protegidos. Coletas não dão XP.
            </p>
          </details>
        </article>
      ) : null}
      {showResult && (
        <article
          className={`panel exploration-resolution resolution-${result.status}`}
          aria-label="Resultado da exploração"
        >
          <span className="eyebrow">
            {result.status === "success"
              ? "EXPEDIÇÃO CONCLUÍDA"
              : result.status === "failed"
                ? "EXPEDIÇÃO FRACASSADA"
                : "EXPEDIÇÃO ABANDONADA"}
          </span>
          <h3>{result.title}</h3>
          <p>
            {result.status === "success"
              ? "Achados guardados!"
              : "Você perdeu os achados da trilha."}
          </p>
          {result.feedback && result.status !== "success" && (
            <ExplorationFeedbackCard
              key={result.feedback.id}
              feedback={result.feedback}
              snapshot={snapshot}
              reveal={revealId === result.id || revealId === result.feedback.id}
              onComplete={() => onPresentationComplete(revealId ?? result.id)}
            />
          )}
          {result.status === "success" && <Finds reward={result.rewards} snapshot={snapshot} />}
          <details>
            <summary>Diário deste encontro</summary>
            {result.log.map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </details>
          <button
            className="button primary result-continue"
            onClick={() => setDismissedResult(result.id)}
          >
            Continuar exploração <ArrowRight size={17} />
          </button>
          {result.status === "success" && (
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
