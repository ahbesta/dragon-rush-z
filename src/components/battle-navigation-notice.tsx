"use client";

import { useEffect, useRef } from "react";
import { Swords, LockKeyhole } from "lucide-react";
import { DragonBall } from "./brand";

export function BattleNavigationNotice({
  destination,
  onClose,
}: {
  destination: string;
  onClose: () => void;
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
      className="battle-navigation-notice"
      aria-labelledby="battle-navigation-title"
      aria-describedby="battle-navigation-description"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="battle-notice-emblem" aria-hidden="true">
        <Swords size={32} />
        <DragonBall stars={4} />
      </div>
      <span className="eyebrow">SEU GUERREIRO ESTÁ NA ARENA</span>
      <h2 id="battle-navigation-title">O combate ainda não acabou!</h2>
      <p id="battle-navigation-description">
        Termine esta batalha para acessar <strong>{destination}</strong>. Escolha seu próximo
        movimento e supere seus limites!
      </p>
      <button className="battle-notice-return" onClick={onClose}>
        <LockKeyhole size={16} /> Voltar ao combate
      </button>
    </dialog>
  );
}
