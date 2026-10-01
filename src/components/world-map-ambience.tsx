"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import {
  ambientActors,
  ambientSprites,
  windLeaves,
  type AmbientActor,
} from "@/lib/world-map-ambience";

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function AmbientActorSprite({ actor }: { actor: AmbientActor }) {
  const sprite = ambientSprites[actor.sprite];
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  const style = {
    left: `${actor.x}%`,
    top: `${actor.y}%`,
    width: `${(actor.width / 1536) * 100}cqw`,
    "--life-aspect": `${sprite.frameWidth} / ${sprite.frameHeight}`,
    "--life-seconds": `${actor.seconds}s`,
    "--life-delay": `${actor.delay}s`,
    "--life-dx": `${actor.dx ?? 0}cqw`,
    // y coordinates use the canvas height (2/3 of its width).
    "--life-dy": `${((actor.dy ?? 0) * 2) / 3}cqw`,
    "--life-frame-seconds": `${sprite.frameSeconds}s`,
  } as CSSProperties;
  return (
    <div
      className={`map-life-actor map-life-${actor.behavior}`}
      data-actor={actor.id}
      data-ready={loaded}
      style={style}
    >
      <div className="map-life-route">
        {(actor.behavior === "patrol" || actor.behavior === "idle") && (
          <span className="map-life-shadow" />
        )}
        <div className="map-life-facing">
          <div className="map-life-window">
            <Image
              className="map-life-sheet"
              src={sprite.src}
              alt=""
              width={sprite.frameWidth * 4}
              height={sprite.frameHeight}
              unoptimized
              loading="eager"
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Ambient life is decorative, silent and independent of all game actions. */
export function WorldMapAmbience({ paused }: { paused: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const visible = useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "visible",
    () => false,
  );
  useEffect(() => {
    if (!root.current) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={root}
      className="world-map-ambience"
      data-playing={inView && visible && !paused}
      aria-hidden="true"
      inert
    >
      <span className="map-life-cloud map-life-cloud-west" />
      <span className="map-life-cloud map-life-cloud-east" />
      <span className="map-life-waterfall map-life-fall-west" />
      <span className="map-life-waterfall map-life-fall-north" />
      <span className="map-life-waterglint map-life-glint-west" />
      <span className="map-life-waterglint map-life-glint-south" />
      <span className="map-life-waterglint map-life-glint-east" />
      {ambientActors.map((actor) => (
        <AmbientActorSprite key={actor.id} actor={actor} />
      ))}
      {windLeaves.map((leaf, index) => (
        <span
          key={index}
          className="map-life-leaf"
          style={{
            left: `${leaf.x}%`,
            top: `${leaf.y}%`,
            animationDelay: `${leaf.delay}s`,
            animationDuration: `${leaf.seconds}s`,
          }}
        />
      ))}
    </div>
  );
}
