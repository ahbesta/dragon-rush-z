"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  HeartCrack,
  Zap,
  TriangleAlert,
  Check,
  X,
  Coins,
  Package,
  ChevronRight,
  DoorOpen,
  Compass,
  LockKeyhole,
} from "lucide-react";
import type { ExplorationFeedback, ExplorationChoiceView } from "@/game/exploration/types";
import type { GameSnapshot } from "@/game/types";
import { ItemIcon, attributeLabels } from "./game-primitives";
import { sortItemsByRarity } from "@/lib/item-presentation";

export function ExplorationFeedbackCard({
  feedback,
  snapshot,
  reveal = false,
  onComplete,
}: {
  feedback: ExplorationFeedback;
  snapshot: GameSnapshot;
  reveal?: boolean;
  onComplete?: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  const modal = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!reveal || feedback.kind !== "loss" || dismissed) return;
    const previous = document.activeElement;
    modal.current?.focus({ preventScroll: true });
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, [reveal, feedback.kind, dismissed]);
  const close = () => {
    setDismissed(true);
    onComplete?.();
  };
  const content = (
    <>
      <div className="expedition-feedback-heading">
        {feedback.kind === "loss" ? (
          <HeartCrack size={25} />
        ) : feedback.kind === "ambush" ? (
          <TriangleAlert size={25} />
        ) : (
          <Check size={25} />
        )}
        <div>
          <span>AVENTURA NA TERRA</span>
          <h3>{feedback.kind === "loss" ? "Achados perdidos!" : feedback.title}</h3>
        </div>
      </div>
      <p>{feedback.message}</p>
      <div className="expedition-deltas">
        {feedback.hpLost > 0 && (
          <strong className="delta-loss">
            <HeartCrack size={18} /> −{feedback.hpLost} HP
          </strong>
        )}
        {feedback.kiSpent > 0 && (
          <strong className="delta-cost">
            <Zap size={18} /> −{feedback.kiSpent} Ki
          </strong>
        )}
        {feedback.zeniSpent > 0 && (
          <strong className="delta-cost">
            <Coins size={18} /> −{feedback.zeniSpent} Zeni gastos
          </strong>
        )}
        {feedback.zeniLost > 0 && (
          <strong className="delta-loss">
            <Coins size={18} /> −{feedback.zeniLost} Zeni da carteira
          </strong>
        )}
        {feedback.gained.xp > 0 && (
          <strong className="delta-gain">
            +{feedback.gained.xp} XP {feedback.kind !== "return" && "pendentes"}
          </strong>
        )}
        {feedback.gained.zeni > 0 && (
          <strong className="delta-gain">
            +{feedback.gained.zeni} Zeni {feedback.kind !== "return" && "pendentes"}
          </strong>
        )}
        {sortItemsByRarity(feedback.gained.items, snapshot.catalog.items).map((drop) => (
          <span className="delta-item delta-gain" key={`gain-${drop.itemId}`}>
            <ItemIcon item={snapshot.catalog.items.find((i) => i.id === drop.itemId)} />
            <ArrowUp size={14} />+{drop.quantity}{" "}
            {snapshot.catalog.items.find((i) => i.id === drop.itemId)?.name}
          </span>
        ))}
        {[
          ...feedback.lost.items.map((drop) => ({ ...drop, spent: false })),
          ...feedback.spentItems.map((drop) => ({ ...drop, spent: true })),
        ].map((drop, index) => (
          <span className="delta-item delta-loss" key={`loss-${index}`}>
            <ItemIcon item={snapshot.catalog.items.find((i) => i.id === drop.itemId)} />
            <ArrowDown size={14} />−{drop.quantity}{" "}
            {snapshot.catalog.items.find((i) => i.id === drop.itemId)?.name} ·{" "}
            {drop.spent ? "consumido" : "perdido"}
          </span>
        ))}
        {feedback.lost.xp > 0 && (
          <strong className="delta-loss">−{feedback.lost.xp} XP pendentes</strong>
        )}
        {feedback.lost.zeni > 0 && (
          <strong className="delta-loss">−{feedback.lost.zeni} Zeni pendentes</strong>
        )}
        {feedback.lost.flags.length > 0 && (
          <strong className="delta-loss">
            {feedback.lost.flags.length} descoberta(s) não registrada(s)
          </strong>
        )}
        {feedback.gained.flags.length > 0 && (
          <strong className="delta-gain">
            +{feedback.gained.flags.length} descoberta(s){" "}
            {feedback.kind === "return" ? "registrada(s)" : "para registrar no retorno"}
          </strong>
        )}
      </div>
      {feedback.kind === "loss" && (
        <small>Inventário anterior protegido · custos e provisões não devolvidos.</small>
      )}
      {feedback.kind === "gain" && (
        <small>
          <Package size={13} /> Achados provisórios. Volte em segurança para receber tudo.
        </small>
      )}
    </>
  );
  return (
    <>
      <div
        className={`expedition-feedback feedback-${feedback.kind}`}
        role="status"
        aria-label="Consequências da escolha"
      >
        {content}
      </div>
      {reveal && feedback.kind === "loss" && !dismissed && (
        <div className="expedition-loss-overlay">
          <div
            className="expedition-feedback feedback-loss expedition-loss-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Perdas da exploração"
            tabIndex={-1}
            ref={modal}
            onKeyDown={(event) => {
              if (event.key === "Escape") close();
              if (event.key === "Tab") {
                const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("button");
                const first = buttons[0],
                  last = buttons[buttons.length - 1];
                if (
                  event.shiftKey &&
                  (document.activeElement === first ||
                    document.activeElement === event.currentTarget)
                ) {
                  event.preventDefault();
                  last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <button
              className="expedition-feedback-close"
              aria-label="Fechar relatório de perdas"
              onClick={close}
            >
              <X size={18} />
            </button>
            {content}
            <button className="button danger" onClick={close}>
              Entendi as consequências
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function ExplorationDecision({
  choice,
  snapshot,
  busy,
  onChoose,
}: {
  choice: ExplorationChoiceView;
  snapshot: GameSnapshot;
  busy: boolean;
  onChoose: () => void;
}) {
  const range = (min: number, max: number) => (min === max ? String(min) : min + "–" + max);
  const safeReturn = choice.id === "retreat";
  const firstItem = snapshot.catalog.items.find(
    (item) => item.id === choice.benefit.items?.[0]?.itemId,
  );
  const label =
    choice.id === "collect" && firstItem
      ? "Recolher " + firstItem.name.toLocaleLowerCase("pt-BR")
      : choice.label;
  return (
    <button
      className={"exploration-choice expedition-command " + (safeReturn ? "command-return" : "")}
      disabled={busy || Boolean(choice.reasons.length)}
      onClick={onChoose}
    >
      <span className="expedition-command-art" aria-hidden="true">
        {firstItem ? (
          <ItemIcon item={firstItem} showcase />
        ) : safeReturn ? (
          <DoorOpen size={25} />
        ) : (
          <Compass size={25} />
        )}
      </span>
      <span className="expedition-command-content">
        <span className="expedition-command-title">
          <strong>{label}</strong>
          <ChevronRight size={18} />
        </span>
        {(choice.check || choice.cost?.ki) && (
          <span className="expedition-command-tags">
            {choice.check && (
              <span
                className="command-chance"
                title={
                  attributeLabels[choice.check.attribute] +
                  " contra dificuldade " +
                  choice.check.target
                }
              >
                {choice.chance}% de sucesso · {attributeLabels[choice.check.attribute]}
              </span>
            )}
            {choice.cost?.ki ? (
              <span className="command-ki">
                <Zap size={13} />
                {choice.cost.ki} KI
                <small>restam {Math.max(0, snapshot.character.ki - choice.cost.ki)}</small>
              </span>
            ) : null}
          </span>
        )}
        {safeReturn ? (
          <span className="command-reward">Achados garantidos.</span>
        ) : (
          <>
            <span className="command-reward">
              {choice.benefit.items?.map((drop) => (
                <span key={drop.itemId}>
                  +{range(drop.min, drop.max)}{" "}
                  {snapshot.catalog.items.find((item) => item.id === drop.itemId)?.name}
                </span>
              ))}
              {choice.benefit.zeni && (
                <span>◈ +{range(choice.benefit.zeni.min, choice.benefit.zeni.max)} Zeni</span>
              )}
              {choice.benefit.xp && <span>+{choice.benefit.xp} XP</span>}
            </span>
            {["help", "listen", "discover", "relic", "tool"].includes(choice.id) && (
              <span className="command-description">{choice.description}</span>
            )}
            {choice.id === "push" && (
              <span className="command-description">Mais materiais neste trecho.</span>
            )}
            {choice.chance < 100 && (
              <span className="command-risk">
                <TriangleAlert size={15} />
                <span>
                  {choice.failure.enemyName ? (
                    <>
                      Falha: <strong>{choice.failure.enemyName}</strong> te embosca. Derrota:
                      achados perdidos · −{choice.failure.zeniPenalty} Zeni.
                    </>
                  ) : (
                    <>
                      Falha: <strong>−{choice.failure.damage} HP</strong>
                      {choice.failure.losesFinds && " · achados perdidos"}
                      {choice.failure.fatal && <strong> · FATAL</strong>}
                    </>
                  )}
                </span>
              </span>
            )}
            {!!choice.cost?.items?.length && (
              <span className="command-consumed">
                Entregue{" "}
                {choice.cost.items
                  .map(
                    (drop) =>
                      drop.quantity +
                      "× " +
                      snapshot.catalog.items.find((item) => item.id === drop.itemId)?.name,
                  )
                  .join(" · ")}{" "}
                da mochila. Não são devolvidos.
              </span>
            )}
            {!!choice.cost?.zeni && (
              <span className="command-consumed">◈ {choice.cost.zeni} Zeni gastos ao tentar.</span>
            )}
            {choice.cost?.ki ? (
              <span className="command-cost-note">O Ki é gasto mesmo se falhar.</span>
            ) : null}
          </>
        )}
        {choice.reasons.length > 0 && (
          <span className="command-locked">
            <LockKeyhole size={13} />
            {choice.reasons.join(" · ")}
          </span>
        )}
      </span>
    </button>
  );
}
