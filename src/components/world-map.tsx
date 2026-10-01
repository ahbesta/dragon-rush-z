"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Compass, LockKeyhole, Map, UserRound, X } from "lucide-react";
import type { GameSnapshot } from "@/game/types";
import { areaArtwork, destinationArtwork } from "@/lib/game-art";
import {
  mapCrossroads,
  mapDestinations,
  mapRaceSprites,
  type MapDestination,
  type MapNavigation,
  type MapPoint,
} from "@/lib/world-map";
import { ArtworkImage } from "./artwork-image";
import { WorldMapAmbience } from "./world-map-ambience";

type Props = {
  snapshot: GameSnapshot;
  busy: boolean;
  onNavigate: (section: MapNavigation) => void;
  onAreaSelect: (mode: "battle" | "explore", areaId: string) => void;
  onCharacter: () => void;
  onTrain: () => void;
  onRest: () => void;
};
type Overlay =
  | { kind: "areas"; mode: "battle" | "explore" }
  | { kind: "activity"; activity: "training" | "rest" };

export function WorldMap({
  snapshot,
  busy,
  onNavigate,
  onAreaSelect,
  onCharacter,
  onTrain,
  onRest,
}: Props) {
  const { character, catalog, activity } = snapshot;
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState("right");
  const [selected, setSelected] = useState<MapDestination | null>(null);
  const [status, setStatus] = useState("Escolha um destino. Sua aventura começa aqui.");
  const [spriteFailed, setSpriteFailed] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const canvas = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const avatar = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation | null>(null);
  const visited = useRef<MapDestination | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const sprite = mapRaceSprites[character.raceId];

  useEffect(
    () => () => {
      animation.current?.cancel();
      animation.current = null;
    },
    [],
  );
  useEffect(() => {
    const scroller = viewport.current;
    if (!scroller) return;
    let width = 0;
    const observer = new ResizeObserver(() => {
      if (!canvas.current || !avatar.current || width === scroller.clientWidth) return;
      width = scroller.clientWidth;
      const ground = canvas.current.getBoundingClientRect();
      const actor = avatar.current.getBoundingClientRect();
      scroller.scrollLeft = actor.left + actor.width / 2 - ground.left - width / 2;
    });
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!overlay || !dialog.current) return;
    const element = dialog.current;
    element.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = previous;
    };
  }, [overlay]);

  function arrive(id: MapDestination) {
    visited.current = id;
    setWalking(false);
    setStatus(`Você chegou: ${mapDestinations.find((d) => d.id === id)!.title}.`);
    if (id === "explore" || id === "battle") setOverlay({ kind: "areas", mode: id });
    else if (id === "training" || id === "rest") setOverlay({ kind: "activity", activity: id });
    else if (id === "market") onNavigate("techniques");
    else if (id === "inventory") onNavigate("inventory");
    else onCharacter();
  }

  function travel(id: MapDestination) {
    const element = avatar.current;
    const ground = canvas.current;
    if (!element || !ground) return;
    const destination = mapDestinations.find((candidate) => candidate.id === id)!;
    const bounds = ground.getBoundingClientRect();
    const actor = element.getBoundingClientRect();
    const start: MapPoint = {
      x: ((actor.left + actor.width / 2 - bounds.left) / bounds.width) * 100,
      y: ((actor.bottom - bounds.top) / bounds.height) * 100,
    };
    const wasWalking = walking;
    animation.current?.cancel();
    const previousPath = !wasWalking
      ? (mapDestinations.find((d) => d.id === visited.current)?.path ?? [])
      : [];
    const route: MapPoint[] = [
      start,
      ...[...previousPath].reverse().slice(1),
      mapCrossroads,
      ...destination.path,
    ];
    const points = route.filter(
      (point, i) => i === 0 || Math.hypot(point.x - route[i - 1].x, point.y - route[i - 1].y) > 0.1,
    );
    const target = points.at(-1)!;
    setSelected(id);
    setFacing(target.x < start.x ? "left" : "right");
    setStatus(`Indo para ${destination.title}...`);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scroller = viewport.current;
    if (scroller && scroller.scrollWidth > scroller.clientWidth) {
      scroller.scrollTo({
        left: (target.x / 100) * ground.offsetWidth - scroller.clientWidth / 2,
        behavior: reduced ? "instant" : "smooth",
      });
    }
    if (reduced || points.length < 2) {
      element.style.left = `${target.x}%`;
      element.style.top = `${target.y}%`;
      arrive(id);
      return;
    }
    setWalking(true);
    const distances = points.map((point, index) =>
      index === 0
        ? 0
        : Math.hypot(point.x - points[index - 1].x, (point.y - points[index - 1].y) / 1.5),
    );
    const total = distances.reduce((sum, distance) => sum + distance, 0);
    let travelled = 0;
    const frames = points.map((point, index) => {
      travelled += distances[index];
      return { left: `${point.x}%`, top: `${point.y}%`, offset: total > 0 ? travelled / total : 1 };
    });
    const movement = element.animate(frames, {
      duration: Math.min(1800, Math.max(550, total * 28)),
      easing: "linear",
      fill: "forwards",
    });
    animation.current = movement;
    movement.onfinish = () => {
      if (animation.current !== movement) return;
      element.style.left = `${target.x}%`;
      element.style.top = `${target.y}%`;
      movement.cancel();
      animation.current = null;
      arrive(id);
    };
  }

  const blocked = busy || Boolean(activity) || Boolean(snapshot.activeBattle);
  const policy =
    overlay?.kind === "activity"
      ? catalog.policies.find((p) => p.id === overlay.activity)
      : undefined;
  return (
    <section className="world-map" aria-label="Mapa interativo da Terra">
      <div className="world-map-heading">
        <div>
          <span className="eyebrow">DRAGON RUSH Z · CAPÍTULO 01</span>
          <h1>
            EXPLORE A <em>TERRA</em>
          </h1>
        </div>
        <span className="world-map-planet">
          <Map size={17} /> SEU MUNDO. SUA JORNADA.
        </span>
      </div>
      <div className="world-map-frame">
        <div
          className="world-map-scroll"
          ref={viewport}
          tabIndex={0}
          aria-label="Mapa da Terra; deslize para ver todos os destinos"
        >
          <div
            className={`world-map-canvas${mapFailed ? " map-art-unavailable" : ""}`}
            ref={canvas}
          >
            {!mapFailed && (
              <Image
                className="world-map-background"
                src="/images/world-map/terra.webp"
                alt="Mapa da Terra com Kame House, campo do Mestre Kame, floresta, arena de artes marciais e mercado de técnicas"
                width={1536}
                height={1024}
                sizes="(max-width: 700px) 720px, 95vw"
                preload
                onError={() => setMapFailed(true)}
              />
            )}
            {!mapFailed && <WorldMapAmbience paused={overlay !== null} />}
            {mapDestinations.map(({ id, title, subtitle, label, icon: Icon, ...destination }) => (
              <button
                key={id}
                className={`world-map-node node-${id}${selected === id ? " selected" : ""}`}
                style={{ left: `${label.x}%`, top: `${label.y}%` }}
                onClick={() => travel(id)}
                aria-label={`Ir para ${title}`}
                aria-haspopup={
                  id === "explore" || id === "battle" || id === "training" || id === "rest"
                    ? "dialog"
                    : undefined
                }
              >
                <span className="world-map-node-symbol">
                  <Icon size={18} />
                </span>
                <strong>{"mapTitle" in destination ? destination.mapTitle : title}</strong>
                <small>{subtitle}</small>
                <span className="world-map-node-tip" />
              </button>
            ))}
            <div
              ref={avatar}
              className="world-map-avatar"
              data-race={character.raceId}
              data-walking={walking}
              style={{ left: `${mapCrossroads.x}%`, top: `${mapCrossroads.y}%` }}
            >
              <span className="world-map-avatar-name">{character.name}</span>
              <span className="world-map-avatar-shadow" />
              <span className={`world-map-avatar-facing ${facing}`}>
                <span className="world-map-avatar-window">
                  {sprite && !spriteFailed ? (
                    <Image
                      className="world-map-walk-sheet"
                      src={sprite.src}
                      alt={sprite.alt}
                      width={384}
                      height={112}
                      unoptimized
                      onError={() => setSpriteFailed(true)}
                    />
                  ) : (
                    <UserRound size={38} aria-label={snapshot.race.name} />
                  )}
                </span>
              </span>
              <span className="world-map-you">VOCÊ</span>
            </div>
            <div className="world-map-compass" aria-hidden="true">
              <Compass size={27} />
              <span>N</span>
            </div>
          </div>
        </div>
        <div className="world-map-status">
          <span className={walking ? "map-status-dot walking" : "map-status-dot"} />
          <span role="status" aria-live="polite">
            {status}
          </span>
          <small>CLIQUE EM UM DESTINO · DESLIZE PARA VER O MAPA</small>
        </div>
      </div>
      <div className="world-map-shortcuts" aria-label="Destinos do mapa">
        {mapDestinations.map(({ id, title, icon: Icon }) => (
          <button key={id} onClick={() => travel(id)} aria-label={`Mapa: ${title}`}>
            <Icon size={15} />
            {title}
          </button>
        ))}
      </div>
      {overlay && (
        <dialog
          ref={dialog}
          className="world-map-dialog"
          aria-labelledby="map-dialog-title"
          onCancel={() => setOverlay(null)}
          onClick={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            if (
              event.target === event.currentTarget &&
              (event.clientX < bounds.left ||
                event.clientX > bounds.right ||
                event.clientY < bounds.top ||
                event.clientY > bounds.bottom)
            )
              setOverlay(null);
          }}
        >
          <button
            className="map-dialog-close"
            aria-label="Fechar destino"
            onClick={() => setOverlay(null)}
            autoFocus
          >
            <X size={21} />
          </button>
          <span className="eyebrow">PLANETA TERRA · ESCOLHA SEU CAMINHO</span>
          <h2 id="map-dialog-title">
            {overlay.kind === "areas"
              ? "Para onde vamos?"
              : overlay.activity === "training"
                ? "Treino do Mestre Kame"
                : "Descanso na Kame House"}
          </h2>
          {overlay.kind === "areas" ? (
            <>
              <p>
                {overlay.mode === "explore"
                  ? "Escolha uma área para explorar e encontrar seus inimigos."
                  : "Escolha a área onde você quer batalhar."}
              </p>
              <div className="map-area-grid">
                {catalog.areas.map((area) => {
                  const locked = character.level < area.minLevel;
                  const art = areaArtwork[area.id];
                  const enemies = catalog.encounters
                    .filter((e) => e.areaId === area.id)
                    .map((e) => catalog.enemies.find((enemy) => enemy.id === e.enemyId)?.name)
                    .filter(Boolean);
                  return (
                    <button
                      key={area.id}
                      className={`map-area-option${locked ? " locked" : ""}`}
                      disabled={locked}
                      onClick={() => {
                        setOverlay(null);
                        onAreaSelect(overlay.mode, area.id);
                      }}
                    >
                      <span className="map-area-art">
                        {art && <ArtworkImage art={art} sizes="(max-width: 600px) 80vw, 350px" />}
                      </span>
                      <span className="map-area-copy">
                        <span className="map-area-level">
                          {locked ? <LockKeyhole size={13} /> : <Compass size={13} />} Nível{" "}
                          {area.minLevel}+
                        </span>
                        <strong>{area.name}</strong>
                        <small>{area.description}</small>
                        <span className="map-area-enemies">{enemies.join(" · ")}</span>
                        <span className="map-area-go">
                          {locked
                            ? "Área bloqueada"
                            : overlay.mode === "battle"
                              ? "Ir batalhar"
                              : "Ir explorar"}
                          <ArrowRight size={15} />
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="map-activity-art">
                <ArtworkImage
                  art={destinationArtwork[overlay.activity]}
                  sizes="(max-width: 700px) 85vw, 700px"
                />
              </div>
              <p>
                {overlay.activity === "training"
                  ? "Fortaleça seu corpo com os exercícios do Mestre Kame e receba experiência."
                  : "Recupere completamente seu HP e Ki antes de voltar à aventura."}
              </p>
              <div className="map-activity-details">
                <span>{policy?.durationSeconds}s por sessão</span>
                <strong>
                  {overlay.activity === "training"
                    ? `+${policy?.xpReward} XP`
                    : "Gratuito · HP e Ki completos"}
                </strong>
              </div>
              <div className="map-activity-actions">
                <button
                  className="button secondary"
                  onClick={() => {
                    setOverlay(null);
                    onNavigate("training");
                  }}
                >
                  Ver treinamento e descanso
                </button>
                <button
                  className="button primary"
                  disabled={blocked}
                  onClick={() => {
                    const kind = overlay.activity;
                    setOverlay(null);
                    onNavigate("training");
                    if (kind === "training") onTrain();
                    else onRest();
                  }}
                >
                  {overlay.activity === "training" ? "Iniciar treinamento" : "Iniciar descanso"}
                  <ArrowRight size={17} />
                </button>
              </div>
              {blocked && (
                <p className="map-activity-warning">
                  {activity
                    ? "Você já tem uma atividade em andamento. Acompanhe e conclua na tela de Treinamento."
                    : snapshot.activeBattle
                      ? "Conclua a batalha em andamento antes de iniciar uma atividade."
                      : "Aguarde a ação atual terminar."}
                </p>
              )}
            </>
          )}
        </dialog>
      )}
    </section>
  );
}
