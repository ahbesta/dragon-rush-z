"use client";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import Image from "next/image";
import {
  ChevronsRight,
  Package,
  RotateCcw,
  SkipForward,
  Swords,
  UserRound,
  Zap,
} from "lucide-react";
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
import { formatNumber, Meter } from "./game-primitives";
import { BattleCommandMenu } from "./battle-command-menu";
import { BattleLog, CombatEventLog } from "./battle-log";
import { BattleLootReveal } from "./battle-loot-reveal";
import { useBattlePlayback } from "./use-battle-playback";
import { BattleTimeline } from "./battle-timeline";
import type { CombatActor, CombatAvatars } from "./combat-avatar";
import { fighterFormation, fighterLayout } from "@/lib/fighter-layout";

function FighterSprite({
  sprite,
  pose,
  label,
}: {
  sprite?: SpriteSheet;
  pose: number;
  label: string;
}) {
  const layout = fighterLayout(sprite, pose);
  return (
    <span
      className="arena-sprite-window"
      data-pose={pose}
      data-frames={sprite?.frames ?? 3}
      style={
        {
          "--sprite-window-width": layout.width,
          "--sprite-window-height": layout.height,
          "--sprite-sheet-width": layout.sheetWidth,
          "--sprite-sheet-height": layout.sheetHeight,
          "--sprite-sheet-left": layout.sheetLeft,
          "--sprite-sheet-bottom": layout.sheetBottom,
        } as CSSProperties
      }
    >
      {sprite ? (
        <Image
          src={sprite.src}
          alt={sprite.alt}
          width={(sprite.frameWidth ?? 160) * (sprite.frames ?? 3)}
          height={sprite.frameHeight ?? 200}
          className="arena-sprite-sheet"
          style={{
            transform: `translateX(${layout.translateX}%)`,
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
  revealLoot,
  onPresentationComplete,
}: {
  snapshot: GameSnapshot;
  busy: boolean;
  onAction: (action: ActionPayload) => void;
  autoplay: boolean;
  onAutoplayConsumed: () => void;
  revealLoot: boolean;
  onPresentationComplete?: (battleId: string) => void;
}) {
  const [lootReplay, setLootReplay] = useState(0);
  const [highlighted, setHighlighted] = useState<CombatActor | null>(null);
  const active = snapshot.activeBattle;
  const battle = active ?? snapshot.latestBattle!;
  const [finishedLootId, setFinishedLootId] = useState<string | null>(null);
  const lootComplete = useCallback(() => setFinishedLootId(battle.id), [battle.id]);
  const enemy = snapshot.catalog.enemies.find((candidate) => candidate.id === battle.enemyId);
  const events = battle.events;
  const start = events.find((event) => event.type === "start");
  const playerName = start?.player ?? snapshot.character.name;
  const enemyName = start?.enemy ?? enemy?.name ?? "Inimigo";
  const fighters: CombatAvatars = {
    player: { name: playerName, sprite: playerBattleSprites[snapshot.character.raceId] },
    enemy: { name: enemyName, sprite: enemyBattleSprites[enemy?.heroicOf ?? battle.enemyId] },
  };
  const formation = fighterFormation([fighters.player.sprite, fighters.enemy.sprite]);
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
    if (active || playback.playing || playback.settledSeq < (model.frames.at(-1)?.seq ?? -1))
      return;
    if (
      revealLoot &&
      snapshot.latestBattle?.outcome === "victory" &&
      snapshot.latestBattle.drops.length &&
      finishedLootId !== battle.id
    )
      return;
    onPresentationComplete?.(battle.id);
  }, [
    active,
    playback.playing,
    playback.settledSeq,
    model.frames,
    revealLoot,
    snapshot.latestBattle,
    finishedLootId,
    battle.id,
    onPresentationComplete,
  ]);
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
  const earnedXp =
    !active && outcome === "victory" && !playback.playing ? snapshot.latestBattle!.xp : undefined;
  const idleCaption = active
    ? "Observe a intenção do inimigo e escolha sua ação."
    : outcome === "victory"
      ? `${enemyName} derrotado!`
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
        <BattleTimeline
          frames={model.frames}
          frame={frame}
          playing={playback.playing}
          active={active}
          fighters={fighters}
          onHighlight={setHighlighted}
        />
      </div>
      <div
        className={`battle-stage ${active ? "stage-manual" : ""} ${frame?.kind === "strike" ? "impact-stage" : ""} ${playback.phase ? "boss-enraged" : ""}`}
        data-scene={sceneKey}
        data-playing={playback.playing}
        data-event-kind={frame?.kind ?? "idle"}
        style={
          {
            "--strike-duration": `${playback.duration}ms`,
            "--fx-color": techniqueFxColor[frame?.techniqueId ?? ""] ?? "#49daff",
            "--formation-width": formation.width,
            "--formation-height": formation.height,
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
          const sprite = fighters[actor].sprite;
          return (
            <div className={`arena-team team-${actor}`} data-team-size={1} key={actor}>
              <div
                className={actorClass(actor)}
                data-highlight={highlighted === actor}
                data-current-turn={(playback.playing ? frame?.actor : active?.initiative) === actor}
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
            </div>
          );
        })}
        {active && (
          <>
            <div className="arena-turn-statuses">
              {Object.entries(active.statuses ?? {}).flatMap(([who, statuses]) =>
                statuses.map((status) => (
                  <span key={`${who}-${status.kind}`}>
                    {who === "player" ? "Você" : "Inimigo"}:{" "}
                    {status.kind === "poison"
                      ? "Veneno"
                      : status.kind === "paralysis"
                        ? "Paralisia"
                        : "Defesa enfraquecida"}
                  </span>
                )),
              )}
            </div>
          </>
        )}
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
                <span className="arena-ki-explosion">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
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
            {earnedXp !== undefined && (
              <strong className="arena-outcome-xp">+{formatNumber(earnedXp)} XP</strong>
            )}
          </div>
        )}
        {!active &&
          snapshot.latestBattle?.outcome === "victory" &&
          snapshot.latestBattle.drops.length > 0 && (
            <BattleLootReveal
              key={`${battle.id}-${lootReplay}`}
              battle={snapshot.latestBattle}
              items={snapshot.catalog.items}
              enabled={!playback.playing}
              reveal={revealLoot || lootReplay > 0}
              onComplete={lootComplete}
            />
          )}
      </div>
      {active && (
        <BattleCommandMenu
          snapshot={snapshot}
          busy={busy}
          playing={playback.playing}
          onAction={onAction}
        />
      )}
      <div className="arena-action-caption" aria-live="polite">
        <Swords size={18} />
        <span>{playback.playing ? (frame?.caption ?? "A batalha começou!") : idleCaption}</span>
        {earnedXp !== undefined && (
          <div className="arena-xp-earned" aria-label="Experiência recebida">
            <Zap size={18} aria-hidden="true" />
            <span>
              <small>EXPERIÊNCIA GANHA</small>
              <strong>+{formatNumber(earnedXp)} XP</strong>
            </span>
          </div>
        )}
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
          {!active &&
            !playback.playing &&
            outcome === "victory" &&
            !!snapshot.latestBattle?.drops.length && (
              <button onClick={() => setLootReplay((n) => n + 1)}>
                <Package size={15} /> Ver drops
              </button>
            )}
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
        <div className="arena-journal-panel">
          <details className="arena-battle-journal" open>
            <summary>Histórico da batalha · {events.length} eventos</summary>
            <CombatEventLog
              events={events}
              names={{ player: playerName, enemy: enemyName }}
              follow
              fighters={fighters}
              onHighlight={setHighlighted}
            />
          </details>
          <p className="manual-battle-hint">
            {active?.manualOnly
              ? "Vença este desafio manualmente uma vez para liberar o automático nas próximas lutas. Termine a batalha para acessar os outros locais."
              : "Termine a batalha para acessar os outros locais. Você pode assumir o automático pelo seletor de modo."}
          </p>
        </div>
      )}
      {!active && snapshot.latestBattle && (
        <BattleLog
          battle={snapshot.latestBattle}
          snapshot={snapshot}
          fighters={fighters}
          onHighlight={setHighlighted}
        />
      )}
    </section>
  );
}
