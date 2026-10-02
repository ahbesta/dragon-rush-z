"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { activityAnimationArtwork } from "@/lib/game-art";
import { ArtworkImage } from "./artwork-image";
import type { GameArtwork } from "@/lib/game-art";
import { formatTrainingTime } from "@/game/training";

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/** Presentation only: mounting and remaining time come from the server activity. */
export function ActivityAnimation({
  kind,
  remaining,
  duration,
  fallbackArt,
  artwork,
  caption,
}: {
  kind: "training" | "rest";
  remaining: number;
  duration: number;
  fallbackArt: GameArtwork;
  artwork?: GameArtwork;
  caption?: string;
}) {
  const scene = artwork ?? activityAnimationArtwork[kind];
  const container = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const visible = useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "visible",
    () => false,
  );

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (failed) {
    return <ArtworkImage art={fallbackArt} sizes="(max-width: 900px) 90vw, 55vw" />;
  }

  return (
    <div
      ref={container}
      className={`activity-animation activity-animation-${kind}`}
      data-activity-animation={kind}
      data-playing={loaded && inView && visible}
      aria-label={
        caption ?? (kind === "training" ? "Treinamento do Mestre Kame" : "Descanso na Kame House")
      }
    >
      <div className="activity-animation-viewport">
        <Image
          className="activity-animation-frames"
          src={scene.src}
          alt={scene.alt}
          width={scene.width}
          height={scene.height}
          unoptimized
          preload
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      </div>
      <div className="activity-animation-caption" aria-hidden="true">
        <span>
          {caption ?? (kind === "training" ? "TREINO DO MESTRE KAME" : "DESCANSO NA KAME HOUSE")}
        </span>
        <strong>{remaining >= 3600 ? formatTrainingTime(remaining) : `${remaining}s`}</strong>
      </div>
      <div className="activity-animation-progress" aria-hidden="true">
        <span style={{ width: `${Math.min(100, Math.max(0, 1 - remaining / duration) * 100)}%` }} />
      </div>
    </div>
  );
}
