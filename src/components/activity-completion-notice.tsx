"use client";
import { useEffect, useRef } from "react";
import { Check, Dumbbell, Heart, LoaderCircle, X } from "lucide-react";
import { DragonBall } from "./brand";

export function ActivityCompletionNotice({
  kind,
  busy,
  error,
  xp,
  onClose,
  onConclude,
}: {
  kind: "training" | "rest";
  busy: boolean;
  error?: string;
  xp?: number;
  onClose: () => void;
  onConclude: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const training = kind === "training";
  const Icon = training ? Dumbbell : Heart;
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="quest-completion activity-completion"
      aria-labelledby="activity-completion-title"
      aria-describedby="activity-completion-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <button
        className="quest-completion-close"
        aria-label="Fechar aviso de atividade"
        disabled={busy}
        onClick={onClose}
      >
        <X size={20} />
      </button>
      <div className="quest-completion-emblem activity-completion-emblem" aria-hidden="true">
        <span className="quest-completion-ring" />
        <Icon size={40} />
        <DragonBall stars={1} />
      </div>
      <span className="eyebrow">
        {training ? "DISCIPLINA QUE VIRA PODER" : "PRONTO PARA VOLTAR À AVENTURA"}
      </span>
      <h2 id="activity-completion-title">
        {training ? "Treino finalizado!" : "Descanso finalizado!"}
      </h2>
      <p id="activity-completion-description">
        {training
          ? xp !== undefined
            ? "Seu treino atingiu o limite de 24 horas. O XP parou de acumular: colete para receber seus ganhos."
            : "Seu treinamento terminou. Conclua a sessão para receber os ganhos e registrar seu progresso."
          : "O tempo de descanso terminou. Conclua para recuperar seu HP e Ki."}
      </p>
      <div className="activity-completion-result">
        <Icon size={22} />
        <span>
          {training
            ? xp !== undefined
              ? `+${xp.toLocaleString("pt-BR")} XP acumulados`
              : "Sessão pronta para concluir"
            : "Recuperação pronta para concluir"}
          <small>
            {training
              ? "Os ganhos são entregues ao confirmar."
              : "A recuperação é aplicada ao confirmar."}
          </small>
        </span>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary quest-completion-cta" onClick={onConclude} disabled={busy}>
        {busy ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}
        {training ? "Concluir treinamento" : "Concluir descanso"}
      </button>
      <button className="quest-completion-later" disabled={busy} onClick={onClose}>
        Depois · a atividade continua disponível
      </button>
    </dialog>
  );
}
