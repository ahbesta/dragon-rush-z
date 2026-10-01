"use client";
import Image from "next/image";
import { UserRound } from "lucide-react";
import type { SpriteSheet } from "@/lib/game-art";

export type CombatActor = "player" | "enemy";
export type CombatAvatars = Record<CombatActor, { name: string; sprite?: SpriteSheet }>;

export function CombatAvatar({
  actor,
  fighters,
  onHighlight,
}: {
  actor: CombatActor;
  fighters: CombatAvatars;
  onHighlight: (actor: CombatActor | null) => void;
}) {
  const { name, sprite } = fighters[actor];
  return (
    <button
      className={`combat-avatar avatar-${actor}`}
      aria-label={`Destacar ${name} na arena`}
      title={name}
      onMouseEnter={() => onHighlight(actor)}
      onMouseLeave={() => onHighlight(null)}
      onFocus={() => onHighlight(actor)}
      onBlur={() => onHighlight(null)}
      onClick={() => onHighlight(actor)}
    >
      {sprite ? (
        <span
          className="combat-avatar-window"
          style={{ width: `${((sprite.frameWidth ?? 160) / 200) * 40}px` }}
        >
          <Image
            src={sprite.src}
            alt=""
            width={(sprite.frameWidth ?? 160) * (sprite.frames ?? 3)}
            height={200}
            unoptimized
          />
        </span>
      ) : (
        <UserRound size={24} />
      )}
    </button>
  );
}
