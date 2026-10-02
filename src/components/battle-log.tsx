"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, ChevronRight, Swords, Trophy, X, Zap } from "lucide-react";
import type { BattleEvent, BattleResult, GameSnapshot } from "@/game/types";
import { formatNumber, ItemIcon } from "./game-primitives";
import { rarityNames } from "./battle-loot-reveal";
import { EnemyPortrait } from "./enemy-portrait";
import { CombatAvatar, type CombatActor, type CombatAvatars } from "./combat-avatar";
import { sortItemsByRarity } from "@/lib/item-presentation";
type HighlightProps = {
  fighters?: CombatAvatars;
  onHighlight?: (actor: CombatActor | null) => void;
};
export function BattleLog({
  battle,
  snapshot,
  fighters,
  onHighlight,
  onContinue,
}: { battle: BattleResult; snapshot: GameSnapshot; onContinue?: () => void } & HighlightProps) {
  const [expanded, setExpanded] = useState(false);
  const enemy = snapshot.catalog.enemies.find((e) => e.id === battle.enemyId);
  const names = { player: snapshot.character.name, enemy: enemy?.name ?? "Inimigo" };
  const victory = battle.outcome === "victory";
  return (
    <section className={`panel battle-result ${battle.outcome}`}>
      <div className="panel-heading">
        <div className="heading-icon">{victory ? <Trophy size={20} /> : <Swords size={20} />}</div>
        <div>
          <span className="eyebrow">RESULTADO DO COMBATE</span>
          <h3>{victory ? "Vitória!" : battle.outcome === "defeat" ? "Derrota!" : "Empate!"}</h3>
        </div>
        <span className={`badge ${victory ? "green" : ""}`}>{enemy?.name}</span>
      </div>
      <div className="battle-versus">
        <span>
          {fighters && onHighlight && (
            <CombatAvatar actor="player" fighters={fighters} onHighlight={onHighlight} />
          )}
          {names.player}
        </span>
        <small>
          <Swords size={20} />
        </small>
        <span className="battle-adversary">
          <EnemyPortrait enemyId={battle.enemyId} artId={enemy?.artId} sizes="100px" />
          {names.enemy}
        </span>
      </div>
      {victory && (
        <div className="battle-rewards">
          <span>
            <Zap size={20} />
            <strong>+{formatNumber(battle.xp)}</strong>
            <small>XP{snapshot.activeExploration ? " PENDENTE" : " RECEBIDO"}</small>
          </span>
          <span className="zeni-color">
            <b>◈</b>
            <strong>+{formatNumber(battle.zeni)}</strong>
            <small>ZENI{snapshot.activeExploration ? " PENDENTE" : " RECEBIDO"}</small>
          </span>
          {sortItemsByRarity(battle.drops, snapshot.catalog.items).map((drop) => (
            <span
              className={`battle-reward-item rarity-${snapshot.catalog.items.find((i) => i.id === drop.itemId)?.rarity ?? "common"}`}
              key={drop.itemId}
            >
              <ItemIcon item={snapshot.catalog.items.find((i) => i.id === drop.itemId)} />
              <span>
                +{drop.quantity} {snapshot.catalog.items.find((i) => i.id === drop.itemId)?.name}
                <small>
                  {
                    rarityNames[
                      snapshot.catalog.items.find((i) => i.id === drop.itemId)?.rarity ?? "common"
                    ]
                  }
                </small>
              </span>
            </span>
          ))}
        </div>
      )}
      {!!battle.zeniLost && (
        <p className="muted">
          Derrota: −{battle.zeniLost} Zeni. Seus níveis, XP e equipamentos foram preservados.
        </p>
      )}
      {snapshot.activeExploration && victory && (
        <p className="battle-bank-note">Volte em segurança para guardar as recompensas.</p>
      )}
      {onContinue && (
        <button className="button primary battle-result-continue" onClick={onContinue}>
          Continuar <ChevronRight size={18} />
        </button>
      )}
      <button className="log-expand" onClick={() => setExpanded((v) => !v)}>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}{" "}
        {expanded ? "Recolher log" : `Ver batalha completa (${battle.events.length} eventos)`}
      </button>
      {expanded && (
        <CombatEventLog
          events={battle.events}
          names={names}
          fighters={fighters}
          onHighlight={onHighlight}
          rewardsPending={Boolean(snapshot.activeExploration)}
        />
      )}
    </section>
  );
}

export function CombatEventLog({
  events,
  names,
  follow = false,
  fighters,
  onHighlight,
  rewardsPending = false,
}: {
  events: BattleEvent[];
  names: { player: string; enemy: string };
  follow?: boolean;
  rewardsPending?: boolean;
} & HighlightProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const atEnd = useRef(true);
  useEffect(() => {
    if (follow && atEnd.current && scroller.current)
      scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [events, follow]);
  return (
    <div
      ref={scroller}
      className="combat-log"
      aria-label="Log de combate"
      tabIndex={0}
      onScroll={(e) => {
        const element = e.currentTarget;
        atEnd.current = element.scrollHeight - element.clientHeight - element.scrollTop < 24;
      }}
    >
      {events.map((event) => {
        const actor =
          "actor" in event
            ? event.type === "damage"
              ? event.target
              : event.actor
            : event.type === "intent"
              ? event.initiative
              : event.type === "phase"
                ? "enemy"
                : undefined;
        return (
          <div className={`log-event log-${event.type}`} key={event.seq}>
            <span className="log-round">{String(event.round).padStart(2, "0")}</span>
            {actor && fighters && onHighlight && (
              <CombatAvatar actor={actor} fighters={fighters} onHighlight={onHighlight} />
            )}
            {event.type === "start" ? (
              <span>A batalha começou.</span>
            ) : event.type === "intent" ? (
              <span>
                {event.description}. {names[event.initiative]} age primeiro.
              </span>
            ) : event.type === "attack" ? (
              <span>
                <strong>{names[event.actor]}</strong> usou {event.techniqueName}.
              </span>
            ) : event.type === "damage" ? (
              <span>
                {names[event.target]} recebeu <strong>{event.amount} de dano</strong>. HP restante:{" "}
                {event.remainingHp}.
              </span>
            ) : event.type === "skill" ? (
              <span>
                {names[event.actor]} concentrou Ki. −{event.kiCost} Ki.
              </span>
            ) : event.type === "effect" ? (
              <span>
                {names[event.actor]}: {event.description}.
              </span>
            ) : event.type === "phase" ? (
              <span>
                <strong>Nova fase:</strong> {event.name}.
              </span>
            ) : event.type === "defeat" ? (
              <span>
                <X size={12} /> {names[event.actor]} foi derrotado.
              </span>
            ) : event.type === "reward" ? (
              <span>
                <Check size={12} />{" "}
                {rewardsPending
                  ? "Recompensas pendentes da expedição."
                  : "Recompensas adicionadas ao personagem."}
              </span>
            ) : (
              <span>Combate encerrado.</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
