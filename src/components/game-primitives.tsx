import { Shield, Swords, Wind, Heart, Zap, Package, CircleDot } from "lucide-react";
import type { Attributes, ItemDefinition } from "@/game/types";
import { itemArtwork } from "@/lib/game-art";
import { ArtworkImage } from "./artwork-image";
export const attributeLabels: Record<keyof Attributes, string> = {
  strength: "Força",
  defense: "Defesa",
  speed: "Velocidade",
  endurance: "Resistência",
};
export const attributeIcons = { strength: Swords, defense: Shield, speed: Wind, endurance: Heart };
export const formatNumber = (n: number) => n.toLocaleString("pt-BR");
export function Meter({
  label,
  value,
  max,
  variant = "hp",
  compact = false,
}: {
  label: string;
  value: number;
  max: number;
  variant?: "hp" | "ki" | "xp";
  compact?: boolean;
}) {
  return (
    <div className={`meter ${variant} ${compact ? "compact" : ""}`}>
      <div className="meter-label">
        <span>
          {variant === "hp" ? <Heart size={12} /> : variant === "ki" ? <Zap size={12} /> : null}
          {label}
        </span>
        <span>
          {formatNumber(value)} <i>/ {formatNumber(max)}</i>
        </span>
      </div>
      <div
        className="meter-track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <span style={{ width: `${Math.min(100, Math.max(0, (value / max) * 100))}%` }} />
      </div>
    </div>
  );
}
export function ItemIcon({
  item,
  showcase = false,
}: {
  item?: ItemDefinition;
  showcase?: boolean;
}) {
  const art = item ? itemArtwork[item.id] : undefined;
  const Icon = !item
    ? Package
    : item.slot === "weapon"
      ? Swords
      : item.slot === "armor"
        ? Shield
        : item.effects.restoreKi && !item.effects.restoreHp
          ? Zap
          : item.id === "semente-deuses"
            ? CircleDot
            : Heart;
  return (
    <span
      className={`item-icon rarity-${item?.rarity ?? "common"} ${art ? "has-art" : ""} ${showcase ? "item-showcase" : ""}`}
    >
      {art ? (
        <ArtworkImage
          art={art}
          sizes={showcase ? "(max-width: 700px) 320px, 220px" : "64px"}
          fallback={<Icon size={24} />}
        />
      ) : (
        <Icon size={24} />
      )}
    </span>
  );
}
export function ItemEffects({ item }: { item: ItemDefinition }) {
  return (
    <div className="item-effects">
      {Object.entries(item.effects.attributes ?? {}).map(([key, value]) => (
        <span key={key}>
          +{value} {attributeLabels[key as keyof Attributes]}
        </span>
      ))}
      {item.effects.restoreHp && <span>+{item.effects.restoreHp * 100}% HP</span>}
      {item.effects.restoreKi && <span>+{item.effects.restoreKi * 100}% Ki</span>}
    </div>
  );
}
export function Scene({ kind }: { kind: string }) {
  return (
    <div className={`scene scene-${kind}`} aria-hidden="true">
      <span className="scene-sun" />
      <span className="scene-cloud c1" />
      <span className="scene-cloud c2" />
      <span className="scene-mountain m1" />
      <span className="scene-mountain m2" />
      <span className="scene-mountain m3" />
      <span className="scene-ground" />
      {kind === "floresta" && (
        <>
          <span className="scene-tree t1" />
          <span className="scene-tree t2" />
          <span className="scene-tree t3" />
        </>
      )}
      {kind === "red-ribbon" && <span className="scene-base">RR</span>}
    </div>
  );
}
