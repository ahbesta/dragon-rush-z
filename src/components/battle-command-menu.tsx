"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowLeft, ChevronRight, X } from "lucide-react";
import type { GameSnapshot } from "@/game/types";
import type { ActionPayload } from "@/game/validation";
import { ItemIcon } from "./game-primitives";
import { itemArtwork, techniqueArtwork, type GameArtwork } from "@/lib/game-art";
import { ArtworkImage } from "./artwork-image";

type MenuPage = "commands" | "techniques" | "items";

function DragonBall() {
  return (
    <span className="command-dragon-ball" aria-hidden="true">
      <i>★ ★</i>
      <i>★ ★</i>
    </span>
  );
}
function CommandArt({ art, glyph }: { art?: GameArtwork; glyph: string }) {
  return (
    <span className="command-art" aria-hidden="true">
      {art ? <ArtworkImage art={art} sizes="52px" /> : glyph}
      <i>{glyph}</i>
    </span>
  );
}

export function BattleCommandMenu({
  snapshot,
  busy,
  playing,
  onAction,
}: {
  snapshot: GameSnapshot;
  busy: boolean;
  playing: boolean;
  onAction: (payload: ActionPayload) => void;
}) {
  const battle = snapshot.activeBattle!;
  const [page, setPage] = useState<MenuPage>("commands");
  const panel = useRef<HTMLDivElement>(null);
  const blocked = busy || playing;
  useLayoutEffect(() => {
    if (page === "commands") return;
    const target =
      panel.current?.querySelector<HTMLButtonElement>(".turn-menu-list button:not(:disabled)") ??
      panel.current?.querySelector<HTMLButtonElement>(".turn-menu-title button:not(:disabled)") ??
      panel.current;
    target?.focus({ preventScroll: true });
  }, [page]);
  const close = () => {
    setPage("commands");
    requestAnimationFrame(() =>
      panel.current
        ?.querySelector<HTMLButtonElement>('button[aria-label="Usar Soco"]')
        ?.focus({ preventScroll: true }),
    );
  };
  const navigate = (next: MenuPage) => {
    if (next === "commands") close();
    else setPage(next);
  };
  const submit = (payload: ActionPayload) => {
    if (blocked) return;
    close();
    onAction(payload);
  };
  const technique = (id: string) =>
    submit({ action: "battle.turn", battleId: battle.id, round: battle.round, techniqueId: id });
  const command = (kind: "guard" | "charge") =>
    submit({
      action: "battle.action",
      battleId: battle.id,
      round: battle.round,
      command: { kind },
    });
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (page === "commands") close();
      else navigate("commands");
    }
    if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
      return;
    event.preventDefault();
    const buttons = Array.from(
      panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
    );
    if (!buttons.length) return;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const index =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (current +
              (["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1) +
              buttons.length) %
            buttons.length;
    buttons[index]?.focus({ preventScroll: true });
  };
  const punch = battle.techniques.find((t) => t.id === "soco");
  return (
    <div
      className="arena-turn-menu arena-command-dock"
      data-open="true"
      aria-label="Comandos do guerreiro"
    >
      <div
        ref={panel}
        id={`turn-menu-${battle.id}`}
        className="turn-menu-panel"
        data-menu-page={page}
        role="group"
        tabIndex={-1}
        aria-label="Menu de turno"
        onKeyDown={keyboard}
      >
        <div className="turn-menu-title">
          {page !== "commands" && (
            <button aria-label="Voltar aos comandos" onClick={() => navigate("commands")}>
              <ArrowLeft size={15} />
            </button>
          )}
          <DragonBall />
          <strong>
            <small>{snapshot.character.name}</small>
            {page === "commands" ? "COMBATE" : page === "techniques" ? "TÉCNICAS" : "BOLSA"}
          </strong>
          <span className="command-round">R{battle.round}</span>
          {page !== "commands" && (
            <button aria-label="Fechar comandos" onClick={close}>
              <X size={14} />
            </button>
          )}
        </div>
        <div className="command-menu-ribbon">
          <span>
            {page === "commands"
              ? busy
                ? "ENVIANDO AÇÃO…"
                : playing
                  ? "EM COMBATE…"
                  : "ESCOLHA SUA AÇÃO"
              : page === "techniques"
                ? "LIBERE SEU PODER"
                : "SUPRIMENTOS DE COMBATE"}
          </span>
          <b>KI {battle.playerKi}</b>
        </div>
        <div className="turn-menu-list">
          {page === "commands" ? (
            <>
              <button
                aria-label="Usar Soco"
                disabled={blocked || !punch?.available}
                onClick={() => technique("soco")}
              >
                <CommandArt art={techniqueArtwork.soco} glyph="撃" />
                <span>
                  Atacar<small>Soco · sem custo</small>
                </span>
              </button>
              <button
                aria-label="Técnicas"
                disabled={blocked}
                onClick={() => navigate("techniques")}
              >
                <CommandArt art={techniqueArtwork.kamehameha} glyph="気" />
                <span>
                  Técnicas<small>Golpes e ataques de Ki</small>
                </span>
                <ChevronRight size={14} />
              </button>
              {battle.version === 2 && (
                <>
                  <button aria-label="Itens" disabled={blocked} onClick={() => navigate("items")}>
                    <CommandArt art={itemArtwork["semente-deuses"]} glyph="豆" />
                    <span>
                      Itens<small>{battle.itemUses ?? 0}/3 usos nesta luta</small>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                  <button aria-label="Defender" disabled={blocked} onClick={() => command("guard")}>
                    <CommandArt art={itemArtwork["armadura-saiyajin"]} glyph="守" />
                    <span>
                      Defender<small>Reduz 50% do dano</small>
                    </span>
                  </button>
                  <button
                    aria-label="Concentrar"
                    disabled={blocked || battle.playerKi >= snapshot.stats.maxKi}
                    onClick={() => command("charge")}
                  >
                    <CommandArt art={techniqueArtwork["rajada-ki"]} glyph="力" />
                    <span>
                      Concentrar<small>Recupera 20% de Ki</small>
                    </span>
                  </button>
                </>
              )}
            </>
          ) : page === "techniques" ? (
            battle.techniques
              .filter((t) => t.id !== "soco")
              .map((t) => (
                <button
                  key={t.id}
                  title={
                    snapshot.catalog.techniques.find((technique) => technique.id === t.id)
                      ?.description
                  }
                  aria-label={`Usar ${t.name}`}
                  disabled={blocked || !t.available}
                  onClick={() => technique(t.id)}
                >
                  <CommandArt art={techniqueArtwork[t.id]} glyph={t.kind === "ki" ? "気" : "撃"} />
                  <span>
                    {t.name}
                    <small>
                      {t.cooldownRemaining
                        ? `Recarga: ${t.cooldownRemaining} rodada(s)`
                        : t.kiCost > battle.playerKi
                          ? "Ki insuficiente"
                          : !t.available
                            ? "Indisponível nesta rodada"
                            : t.kiCost
                              ? `${t.kiCost} Ki`
                              : "Sem custo de Ki"}
                    </small>
                  </span>
                </button>
              ))
          ) : (
            <>
              <p className="turn-menu-note">
                {battle.itemCooldown
                  ? `Recarga: ${battle.itemCooldown} rodada(s)`
                  : "Usar um item consome sua ação."}
              </p>
              {battle.consumables
                ?.filter((i) => i.quantity > 0)
                .map((i) => {
                  const item = snapshot.catalog.items.find(
                    (candidate) => candidate.id === i.itemId,
                  );
                  return (
                    item && (
                      <button
                        key={i.itemId}
                        title={item.description}
                        aria-label={`Usar ${item.name}`}
                        disabled={blocked || !i.available}
                        onClick={() =>
                          submit({
                            action: "battle.action",
                            battleId: battle.id,
                            round: battle.round,
                            command: { kind: "item", itemId: i.itemId },
                          })
                        }
                      >
                        <ItemIcon item={item} />
                        <span>
                          {item.name}
                          <small>
                            ×{i.quantity}
                            {!i.available ? " · indisponível" : ""}
                          </small>
                        </span>
                      </button>
                    )
                  );
                })}
              {!battle.consumables?.some((i) => i.quantity > 0) && (
                <p className="turn-menu-note">
                  Sua bolsa está vazia. Prepare os consumíveis antes da próxima luta.
                </p>
              )}
            </>
          )}
        </div>
        <div className="turn-menu-footer">
          <span className="command-school-mark" aria-hidden="true">
            亀
          </span>
          <span>
            DRAGON RUSH <b>Z</b>
            <small>Supere seus limites</small>
          </span>
          <span className="command-capsule-mark" aria-hidden="true">
            C
          </span>
        </div>
      </div>
    </div>
  );
}
