"use client";
import { useEffect, useMemo, type CSSProperties } from "react";
import Image from "next/image";
import { ChevronsRight, RotateCcw, SkipForward, Swords, UserRound, Zap } from "lucide-react";
import type { GameSnapshot } from "@/game/types";
import type { ActionPayload } from "@/game/validation";
import { presentBattleEvents, techniqueFxColor } from "@/lib/battle-presentation";
import {
  battleArenaArtwork,
  enemyBattleSprites,
  playerBattleSprites,
  type SpriteSheet,
} from "@/lib/game-art";
import { ArtworkImage } from "./artwork-image";
import { Meter } from "./game-primitives";
import { CombatTechniqueButtons } from "./combat-controls";
import { CombatEventLog } from "./battle-log";
import { useBattlePlayback } from "./use-battle-playback";

function FighterSprite({
  sprite,
  pose,
  label,
}: {
  sprite?: SpriteSheet;
  pose: number;
  label: string;
}) {
  return (
    <span
      className="arena-sprite-window"
      data-pose={pose}
      style={{ "--frame-width-ratio": (sprite?.frameWidth ?? 160) / 160 } as CSSProperties}
    >
      {sprite ? (
        <Image
          src={sprite.src}
          alt={sprite.alt}
          width={(sprite.frameWidth ?? 160) * (sprite.frames ?? 3)}
          height={200}
          className="arena-sprite-sheet"
          style={{
            width: `${100 * (sprite.frames ?? 3)}%`,
            transform: `translateX(${(-100 * (sprite.frames === 1 ? 0 : pose)) / (sprite.frames ?? 3)}%)`,
          }}
          sizes="(max-width: 600px) 360px, 600px"
          unoptimized
        />
      ) : (
        <UserRound aria-label={label} size={70} />
      )}
    </span>
  );
}

export function BattleArena({
  snapshot,
  busy,
  onAction,
  autoplay,
  onAutoplayConsumed,
}: {
  snapshot: GameSnapshot;
  busy: boolean;
  onAction: (action: ActionPayload) => void;
  autoplay: boolean;
  onAutoplayConsumed: () => void;
}) {
  const active = snapshot.activeBattle;
  const battle = active ?? snapshot.latestBattle!;
  const enemy = snapshot.catalog.enemies.find((candidate) => candidate.id === battle.enemyId);
  const events = battle.events;
  const start = events.find((event) => event.type === "start");
  const playerName = start?.player ?? snapshot.character.name;
  const enemyName = start?.enemy ?? enemy?.name ?? "Inimigo";
  const model = useMemo(
    () =>
      presentBattleEvents(events, snapshot.catalog.techniques, {
        playerHp: battle.playerHp,
        playerKi: battle.playerKi,
        playerMaxHp: snapshot.stats.maxHp,
        playerMaxKi: snapshot.stats.maxKi,
        enemyHp: active?.enemyHp ?? enemy?.maxHp ?? 1,
        enemyKi: active?.enemyKi ?? 0,
        enemyMaxHp: active?.enemyMaxHp ?? enemy?.maxHp ?? 1,
        enemyMaxKi: active?.enemyMaxKi ?? enemy?.maxKi ?? 0,
      }),
    [
      events,
      snapshot.catalog.techniques,
      snapshot.stats.maxHp,
      snapshot.stats.maxKi,
      battle.playerHp,
      battle.playerKi,
      active?.enemyHp,
      active?.enemyKi,
      active?.enemyMaxHp,
      active?.enemyMaxKi,
      enemy?.maxHp,
      enemy?.maxKi,
    ],
  );
  const playback = useBattlePlayback(model, autoplay);
  useEffect(() => {
    if (!autoplay) return;
    const frame = requestAnimationFrame(onAutoplayConsumed);
    return () => cancelAnimationFrame(frame);
  }, [autoplay, onAutoplayConsumed]);
  const frame = playback.frame;
  const areaId =
    battle.areaId ??
    snapshot.catalog.encounters.find(
      (encounter) => encounter.enemyId === (enemy?.heroicOf ?? battle.enemyId),
    )?.areaId ??
    "floresta";
  const sceneKey =
    (enemy?.heroicOf ?? enemy?.id) === "piccolo-daimao"
      ? "palacio-daimao"
      : areaId in battleArenaArtwork
        ? (areaId as keyof typeof battleArenaArtwork)
        : "floresta";
  const background = battleArenaArtwork[sceneKey];
  const areaName =
    snapshot.catalog.areas.find((area) => area.id === areaId)?.name ?? "Planeta Terra";
  const pose = (actor: "player" | "enemy") =>
    frame?.kind === "strike" && frame.actor === actor
      ? frame.ki
        ? 2
        : actor === "player" && frame.techniqueId === "chute"
          ? 3
          : 1
      : 0;
  const actorClass = (actor: "player" | "enemy") =>
    [
      "arena-fighter",
      actor,
      frame?.kind === "strike" && frame.actor === actor ? (frame.ki ? "casting" : "attacking") : "",
      frame?.kind === "strike" && frame.target === actor ? "hurt" : "",
      playback.vitals[actor === "player" ? "playerHp" : "enemyHp"] <= 0 ? "fallen" : "",
    ]
      .filter(Boolean)
      .join(" ");
  const outcome = !active ? snapshot.latestBattle?.outcome : undefined;
  const idleCaption = active
    ? "Observe a intenção do inimigo e escolha sua ação."
    : outcome === "victory"
      ? "Vitória! Seu guerreiro superou mais um desafio."
      : outcome === "defeat"
        ? "Derrota. Recupere suas forças e volte à arena."
        : "Combate encerrado.";
  return (
    <section
      className={`battle-arena ${active ? "manual-battle" : "arena-completed"}`}
      aria-label={active ? "Combate manual" : "Reprodução do combate"}
      data-battle-id={battle.id}
    >
      <div className="arena-topbar">
        <div>
          <span className="eyebrow">DRAGON RUSH Z · ARENA DE COMBATE</span>
          <h2>
            {playerName} vs {enemyName}
          </h2>
        </div>
        <span className="arena-round">
          {active
            ? `Rodada ${active.round}`
            : outcome === "victory"
              ? "VITÓRIA"
              : outcome === "defeat"
                ? "DERROTA"
                : "EMPATE"}
        </span>
      </div>
      <div className="arena-hud">
        <div className="arena-status player-status">
          <div className="arena-fighter-name">
            <strong>{playerName}</strong>
            <small>
              {snapshot.race.name} · Nível {snapshot.character.level}
            </small>
          </div>
          <Meter label="Seu HP" value={playback.vitals.playerHp} max={model.maximum.playerHp} />
          <Meter
            label="Seu Ki"
            value={playback.vitals.playerKi}
            max={model.maximum.playerKi}
            variant="ki"
          />
        </div>
        <span className="arena-hud-versus">VS</span>
        <div className="arena-status enemy-status">
          <div className="arena-fighter-name">
            <strong>{enemyName}</strong>
            <small>
              {enemy?.boss ? "BOSS" : "INIMIGO"} · Nível {enemy?.level ?? "?"}
            </small>
          </div>
          <Meter
            label="HP do inimigo"
            value={playback.vitals.enemyHp}
            max={model.maximum.enemyHp}
          />
          <Meter
            label="Ki do inimigo"
            value={playback.vitals.enemyKi}
            max={model.maximum.enemyKi}
            variant="ki"
          />
        </div>
      </div>
      <div
        className={`battle-stage ${frame?.kind === "strike" ? "impact-stage" : ""} ${playback.phase ? "boss-enraged" : ""}`}
        data-scene={sceneKey}
        data-playing={playback.playing}
        data-event-kind={frame?.kind ?? "idle"}
        style={
          {
            "--strike-duration": `${playback.duration}ms`,
            "--fx-color": techniqueFxColor[frame?.techniqueId ?? ""] ?? "#49daff",
          } as CSSProperties
        }
      >
        <ArtworkImage
          art={background}
          preload
          sizes="(max-width: 1200px) 100vw, 1200px"
          className="arena-background"
        />
        <div className="arena-vignette" />
        <div className="arena-location">
          <span className="arena-location-dot" />
          {areaName}
        </div>
        <div className="arena-floor-grid" />
        {(["player", "enemy"] as const).map((actor) => {
          const sprite =
            actor === "player"
              ? playerBattleSprites[snapshot.character.raceId]
              : enemyBattleSprites[enemy?.heroicOf ?? battle.enemyId];
          return (
            <div
              key={actor}
              className={actorClass(actor)}
              style={{ "--sprite-scale": sprite?.scale ?? 1 } as CSSProperties}
            >
              <span className="arena-ground-shadow" />
              <div className="arena-fighter-motion">
                <span className="arena-aura" />
                <FighterSprite
                  sprite={sprite}
                  pose={pose(actor)}
                  label={actor === "player" ? playerName : enemyName}
                />
              </div>
              <span className="arena-side-tag">
                {actor === "player" ? "VOCÊ" : enemy?.boss ? "BOSS" : "INIMIGO"}
              </span>
            </div>
          );
        })}
        {frame?.kind === "strike" && (
          <div
            className={`arena-fx fx-from-${frame.actor} ${frame.ki ? "fx-ki" : "fx-physical"}`}
            key={playback.cycle}
            aria-hidden="true"
          >
            {frame.ki ? (
              <>
                <span className="arena-ki-charge" />
                <span className="arena-ki-projectile">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="arena-beam-trail" />
              </>
            ) : (
              <>
                <span className="arena-speed-lines" />
                <span className="arena-slash" />
              </>
            )}
            <span className="arena-hit-burst">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className="arena-damage-number">
              −{frame.damage}
              <small>DANO</small>
            </span>
            <span className="arena-impact-ring" />
          </div>
        )}
        {frame?.kind === "phase" && (
          <div className="arena-phase-banner" key={playback.cycle}>
            <Zap size={22} />
            <strong>{frame.caption}</strong>
          </div>
        )}
        {!active && !playback.playing && (
          <div className={`arena-outcome ${outcome}`}>
            <span>
              {outcome === "victory" ? "VITÓRIA" : outcome === "defeat" ? "DERROTA" : "EMPATE"}
            </span>
            <small>
              {outcome === "victory" ? "SUPERE SEUS LIMITES" : "A SUA JORNADA CONTINUA"}
            </small>
          </div>
        )}
      </div>
      <div className="arena-action-caption" aria-live="polite">
        <Swords size={18} />
        <span>{playback.playing ? (frame?.caption ?? "A batalha começou!") : idleCaption}</span>
        {frame?.round ? <small>RODADA {frame.round}</small> : null}
      </div>
      <div className="arena-playback-controls">
        <span>
          {playback.reducedMotion
            ? "Movimento reduzido"
            : active
              ? "MANUAL · CADA GOLPE IMPORTA"
              : "REPRODUÇÃO DA BATALHA"}
        </span>
        <div>
          {!playback.reducedMotion && (
            <button
              onClick={playback.toggleSpeed}
              aria-label={`Velocidade da animação: ${playback.speed}x`}
            >
              <ChevronsRight size={15} />
              {playback.speed}x
            </button>
          )}
          {playback.playing ? (
            <button onClick={playback.skip}>
              <SkipForward size={15} />
              Pular animação
            </button>
          ) : (
            !active && (
              <button onClick={playback.replay} disabled={playback.reducedMotion}>
                <RotateCcw size={15} />
                Rever batalha
              </button>
            )
          )}
        </div>
      </div>
      {active && (
        <div className="arena-commands">
          <div className="arena-command-heading">
            <div>
              <span className="eyebrow">SUA PRÓXIMA AÇÃO</span>
              <h3>{active?.version === 2 ? "Escolha sua ação" : "Escolha sua técnica"}</h3>
            </div>
            <small>
              {busy
                ? "Enviando seu golpe..."
                : playback.playing
                  ? "Acompanhe o ataque ou pule a animação."
                  : "A velocidade decide quem ataca primeiro."}
            </small>
          </div>
          <CombatTechniqueButtons
            snapshot={snapshot}
            busy={busy || playback.playing}
            onAction={onAction}
          />
          <details className="arena-battle-journal">
            <summary>Histórico da batalha · {events.length} eventos</summary>
            <CombatEventLog events={events} names={{ player: playerName, enemy: enemyName }} />
          </details>
          <p className="manual-battle-hint">
            {active?.manualOnly
              ? "A luta fica salva ao sair. Bosses e provas são concluídos com suas ações manuais."
              : "A luta fica salva ao sair. Você pode assumir o automático pelo seletor de modo."}
          </p>
        </div>
      )}
    </section>
  );
}
