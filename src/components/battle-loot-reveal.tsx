"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, Check, LoaderCircle, X } from "lucide-react";
import type { BattleResult, ItemDefinition, Rarity } from "@/game/types";
import { ItemIcon } from "./game-primitives";
import { sortItemsByRarity } from "@/lib/item-presentation";

export const rarityNames: Record<Rarity, string> = {
  common: "COMUM",
  uncommon: "INCOMUM",
  rare: "RARO",
  epic: "ÉPICO",
};
export function BattleLootReveal({
  battle,
  items,
  enabled,
  reveal,
  onComplete,
}: {
  battle: BattleResult;
  items: ItemDefinition[];
  enabled: boolean;
  reveal: boolean;
  onComplete?: () => void;
}) {
  const [index, setIndex] = useState<number | null>(0);
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const art = useRef<HTMLDivElement>(null);
  const drops = useMemo(() => sortItemsByRarity(battle.drops, items), [battle.drops, items]);
  const drop = index === null ? undefined : drops[index];
  const item = items.find((i) => i.id === drop?.itemId);
  const revealKey = `${battle.id}-${index}`;
  const artReady = readyFor === revealKey;
  useEffect(() => {
    if (enabled && reveal && (!drops.length || index === null)) onComplete?.();
  }, [enabled, reveal, drops.length, index, onComplete]);
  const advance = () =>
    setIndex((current) =>
      current === null || current + 1 >= battle.drops.length ? null : current + 1,
    );
  useEffect(() => {
    if (!enabled || !reveal || !drop || index === null) return;
    const image = art.current?.querySelector("img");
    const ready = () => setReadyFor(revealKey);
    if (!image || image.complete) {
      ready();
      return;
    }
    image.addEventListener("load", ready);
    image.addEventListener("error", ready);
    return () => {
      image.removeEventListener("load", ready);
      image.removeEventListener("error", ready);
    };
  }, [enabled, reveal, drop, index, revealKey]);
  useEffect(() => {
    if (!enabled || !reveal || index === null || !drop) return;
    const timer = artReady
      ? setTimeout(
          () =>
            setIndex((current) =>
              current === null || current + 1 >= battle.drops.length ? null : current + 1,
            ),
          item?.rarity === "epic" ? 3800 : item?.rarity === "rare" ? 3200 : 2500,
        )
      : undefined;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIndex(null);
    };
    window.addEventListener("keydown", escape);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", escape);
    };
  }, [enabled, reveal, index, drop, item?.rarity, battle.drops.length, artReady]);
  if (!enabled || !reveal || !drop || index === null) return null;
  const rarity = item?.rarity ?? "common";
  return (
    <div
      className={`arena-loot-reveal loot-${rarity}`}
      data-rarity={rarity}
      data-item-id={drop.itemId}
    >
      <div className="arena-loot-dim" />
      <div
        className="arena-loot-card"
        key={`${battle.id}-${index}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <button
          className="arena-loot-close"
          aria-label="Fechar drops"
          onClick={() => setIndex(null)}
        >
          <X size={17} />
        </button>
        <span className="arena-loot-eyebrow">
          ITEM OBTIDO · {index + 1}/{battle.drops.length}
        </span>
        <div ref={art} className="arena-loot-art" data-ready={artReady}>
          <span className="arena-loot-rays" aria-hidden="true" />
          <span className="arena-loot-ring" aria-hidden="true" />
          {Array.from({ length: 8 }, (_, i) => (
            <i
              key={i}
              className="arena-loot-spark"
              aria-hidden="true"
              style={
                { "--spark-angle": `${i * 45}deg`, "--spark-delay": `${i * 65}ms` } as CSSProperties
              }
            />
          ))}
          <ItemIcon item={item} showcase />
          {!artReady && (
            <LoaderCircle className="arena-loot-loading" size={28} aria-label="Revelando item" />
          )}
          <span className="arena-loot-quantity">×{drop.quantity}</span>
        </div>
        <strong className="arena-loot-rarity">{rarityNames[rarity]}</strong>
        <h3>{item?.name ?? "Item recebido"}</h3>
        <span className="arena-loot-saved">
          <Check size={12} /> Adicionado à mochila
        </span>
        <button className="arena-loot-next" onClick={advance} disabled={!artReady}>
          {index + 1 < battle.drops.length ? "Próximo item" : "Continuar"}
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
