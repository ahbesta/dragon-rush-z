"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import type { GameArtwork } from "@/lib/game-art";

export function ArtworkImage({
  art,
  sizes,
  className = "",
  fallback,
  preload = false,
}: {
  art: GameArtwork;
  sizes: string;
  className?: string;
  fallback?: ReactNode;
  preload?: boolean;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (failedSource === art.src) return <>{fallback}</>;
  return (
    <Image
      src={art.src}
      alt={art.alt}
      width={art.width}
      height={art.height}
      sizes={sizes}
      className={className}
      preload={preload}
      onError={() => setFailedSource(art.src)}
    />
  );
}
