"use client";
import { Swords } from "lucide-react";
import { enemyArtwork } from "@/lib/game-art";
import { ArtworkImage } from "./artwork-image";

export function EnemyPortrait({
  enemyId,
  className = "",
  sizes = "96px",
}: {
  enemyId: string;
  className?: string;
  sizes?: string;
}) {
  const art = enemyArtwork[enemyId];
  return (
    <span className={`enemy-portrait ${className}`}>
      {art ? (
        <ArtworkImage art={art} sizes={sizes} fallback={<Swords size={32} />} />
      ) : (
        <Swords size={32} />
      )}
    </span>
  );
}
