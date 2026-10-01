"use client";
import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Swords, Trophy, X, Zap } from "lucide-react";
import type { BattleEvent, BattleResult, GameSnapshot } from "@/game/types";
import { formatNumber } from "./game-primitives";
import { EnemyPortrait } from "./enemy-portrait";
export function BattleLog({ battle, snapshot }: { battle: BattleResult; snapshot: GameSnapshot }) {
  const [expanded, setExpanded] = useState(false);
  const enemy = snapshot.catalog.enemies.find((e) => e.id === battle.enemyId);
  const names = { player: snapshot.character.name, enemy: enemy?.name ?? "Inimigo" };
  const victory = battle.outcome === "victory";
  const events = expanded ? battle.events : battle.events.slice(-7);
  return (
    <section className={`panel battle-result ${battle.outcome}`}>
      <div className="panel-heading">
        <div className="heading-icon">{victory ? <Trophy size={20} /> : <Swords size={20} />}</div>
        <div>
          <span className="eyebrow">RESULTADO DO COMBATE</span>
          <h3>
            {victory
              ? "Vitória!"
              : battle.outcome === "defeat"
                ? "Seu treino continua."
                : "Forças equilibradas."}
          </h3>
        </div>
        <span className={`badge ${victory ? "green" : ""}`}>{enemy?.name}</span>
      </div>
      <div className="battle-versus">
        <span>{names.player}</span>
        <small>VS</small>
        <span className="battle-adversary">
          <EnemyPortrait enemyId={battle.enemyId} artId={enemy?.artId} sizes="100px" />
          {names.enemy}
        </span>
      </div>
      {victory && (
        <div className="battle-rewards">
          <span>
            <Zap size={15} /> +{formatNumber(battle.xp)} XP
          </span>
          <span className="zeni-color">◈ +{formatNumber(battle.zeni)} Zeni</span>
          {battle.drops.map((drop) => (
            <span key={drop.itemId}>
              +{drop.quantity} {snapshot.catalog.items.find((i) => i.id === drop.itemId)?.name}
            </span>
          ))}
        </div>
      )}
      {!!battle.zeniLost && (
        <p className="muted">
          Derrota: −{battle.zeniLost} Zeni. Seus níveis, XP e equipamentos foram preservados.
        </p>
      )}
      <CombatEventLog events={events} names={names} />
      <button className="log-expand" onClick={() => setExpanded((v) => !v)}>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}{" "}
        {expanded ? "Recolher log" : `Ver batalha completa (${battle.events.length} eventos)`}
      </button>
    </section>
  );
}

export function CombatEventLog({
  events,
  names,
}: {
  events: BattleEvent[];
  names: { player: string; enemy: string };
}) {
  return (
    <div className="combat-log" aria-label="Log de combate">
      {events.map((event) => (
        <div className={`log-event log-${event.type}`} key={event.seq}>
          <span className="log-round">{String(event.round).padStart(2, "0")}</span>
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
              <Check size={12} /> Recompensas adicionadas ao personagem.
            </span>
          ) : (
            <span>Combate encerrado.</span>
          )}
        </div>
      ))}
    </div>
  );
}
