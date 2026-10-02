"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, Check, ScrollText, Sparkles, X, Zap } from "lucide-react";
import type { ItemDefinition, QuestDefinition } from "@/game/types";
import { DragonBall } from "./brand";
import { formatNumber, ItemIcon } from "./game-primitives";

export function QuestCompletionNotice({
  quests,
  items,
  onClose,
  onRewards,
}: {
  quests: QuestDefinition[];
  items: ItemDefinition[];
  onClose: () => void;
  onRewards: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="quest-completion"
      aria-labelledby="quest-completion-title"
      aria-describedby="quest-completion-description"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <button
        className="quest-completion-close"
        aria-label="Fechar aviso de missão"
        onClick={onClose}
      >
        <X size={20} />
      </button>
      <div className="quest-completion-emblem" aria-hidden="true">
        <span className="quest-completion-ring" />
        <DragonBall stars={4} />
        <Check size={24} />
      </div>
      <span className="eyebrow">MAIS UM PASSO NA SUA SAGA</span>
      <h2 id="quest-completion-title">
        {quests.length === 1 ? "Missão cumprida!" : "Missões cumpridas!"}
      </h2>
      <p id="quest-completion-description">
        Você completou os objetivos. Quer ir receber sua recompensa?
      </p>
      <div className="quest-completion-list">
        {quests.map((quest) => (
          <article key={quest.id}>
            <div className="quest-completion-name">
              <ScrollText size={20} />
              <h3>{quest.name}</h3>
            </div>
            <span className="quest-reward-label">RECOMPENSA DISPONÍVEL PARA RESGATE</span>
            <div className="quest-completion-rewards">
              <span>
                <Zap size={16} />
                {formatNumber(quest.rewards.xp)} XP
              </span>
              <span>◈ {formatNumber(quest.rewards.zeni)} Zeni</span>
            </div>
            {quest.rewards.items?.map((reward) => {
              const item = items.find((candidate) => candidate.id === reward.itemId);
              return (
                <div className="quest-completion-item" key={reward.itemId}>
                  <ItemIcon item={item} />
                  <span>
                    {reward.quantity}× {item?.name ?? reward.itemId}
                  </span>
                </div>
              );
            })}
          </article>
        ))}
      </div>
      <button className="button primary quest-completion-cta" onClick={onRewards}>
        <Sparkles size={18} />
        Ir receber recompensa
        <ArrowRight size={18} />
      </button>
      <button className="quest-completion-later" onClick={onClose}>
        Depois · fica disponível em Missões
      </button>
    </dialog>
  );
}
