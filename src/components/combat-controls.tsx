"use client";
import { Bot, Hand, LoaderCircle, Swords, Shield, Zap } from "lucide-react";
import type { ActionPayload } from "@/game/validation";
import type { GameSnapshot } from "@/game/types";
import { techniqueArtwork } from "@/lib/game-art";
import { ArtworkImage } from "./artwork-image";
import { ItemIcon } from "./game-primitives";

type Controls = {
  snapshot: GameSnapshot;
  busy: boolean;
  onAction: (payload: ActionPayload) => void;
};
export function CombatModeSelector({ snapshot, busy, onAction }: Controls) {
  const mode = snapshot.character.combatMode;
  return (
    <section className="combat-mode-panel" aria-label="Modo de combate">
      <div>
        <span className="eyebrow orange">SEU ESTILO DE LUTA</span>
        <h2>Modo de combate</h2>
        <p>
          {snapshot.activeBattle?.manualOnly
            ? "Bosses e provas de mestres são manuais. Esta preferência vale para o farm."
            : snapshot.activeBattle
              ? "Você pode assumir o automático para concluir esta luta."
              : mode === "manual"
                ? "Escolha uma técnica a cada rodada."
                : "Suas técnicas são usadas na prioridade definida."}
        </p>
      </div>
      <div className="combat-mode-options" role="group" aria-label="Escolher modo de combate">
        <button
          className={mode === "automatic" ? "selected" : ""}
          aria-pressed={mode === "automatic"}
          disabled={busy}
          onClick={() => onAction({ action: "combat.mode", mode: "automatic" })}
        >
          <Bot size={20} />
          <span>
            Automático<small>O guerreiro luta por você</small>
          </span>
        </button>
        <button
          className={mode === "manual" ? "selected" : ""}
          aria-pressed={mode === "manual"}
          disabled={busy}
          onClick={() => onAction({ action: "combat.mode", mode: "manual" })}
        >
          <Hand size={20} />
          <span>
            Manual<small>Você escolhe os golpes</small>
          </span>
        </button>
      </div>
    </section>
  );
}

export function CombatTechniqueButtons({ snapshot, busy, onAction }: Controls) {
  const battle = snapshot.activeBattle;
  if (!battle) return null;
  return (
    <div className="rpg-combat-controls">
      {battle.version === 2 && (
        <>
          <div className="rpg-intent">
            <span className="eyebrow orange">
              PRÓXIMA RODADA ·{" "}
              {battle.initiative === "player" ? "VOCÊ AGE PRIMEIRO" : "INIMIGO AGE PRIMEIRO"}
            </span>
            <strong>{battle.intent?.label}</strong>
            <small>
              {battle.intent?.kind === "charge"
                ? "Ele ficará vulnerável. Um golpe que interrompe concentração cancela a carga."
                : battle.intent?.kind === "guard"
                  ? "A guarda reduz seu dano. Considere recuperar Ki ou usar um item."
                  : "Prepare sua resposta. Defender protege mesmo quando o inimigo age primeiro."}
            </small>
          </div>
          <div className="rpg-statuses">
            {Object.entries(battle.statuses ?? {}).flatMap(([who, statuses]) =>
              statuses.map((s) => (
                <span className="badge" key={`${who}-${s.kind}`}>
                  {who === "player" ? "Você" : "Inimigo"}:{" "}
                  {s.kind === "poison"
                    ? "Veneno"
                    : s.kind === "paralysis"
                      ? "Paralisia"
                      : "Defesa enfraquecida"}
                </span>
              )),
            )}
          </div>
          <div className="rpg-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                onAction({
                  action: "battle.action",
                  battleId: battle.id,
                  round: battle.round,
                  command: { kind: "guard" },
                })
              }
            >
              <Shield size={18} /> Defender · −50% dano
            </button>
            <button
              className="button secondary"
              disabled={busy || battle.playerKi >= snapshot.stats.maxKi}
              onClick={() =>
                onAction({
                  action: "battle.action",
                  battleId: battle.id,
                  round: battle.round,
                  command: { kind: "charge" },
                })
              }
            >
              <Zap size={18} /> Concentrar · +20% Ki
            </button>
          </div>
          <div className="rpg-combat-items" aria-label="Itens durante a batalha">
            <span>
              {battle.itemUses ?? 0}/3 usos ·{" "}
              {battle.itemCooldown
                ? `Recarga: ${battle.itemCooldown} rodada(s)`
                : "Itens disponíveis"}
            </span>
            {battle.consumables?.map((i) => {
              const item = snapshot.catalog.items.find((it) => it.id === i.itemId);
              return (
                item && (
                  <button
                    key={i.itemId}
                    className="manual-technique"
                    disabled={busy || !i.available}
                    onClick={() =>
                      onAction({
                        action: "battle.action",
                        battleId: battle.id,
                        round: battle.round,
                        command: { kind: "item", itemId: i.itemId },
                      })
                    }
                  >
                    <ItemIcon item={item} />
                    <span>
                      <strong>
                        {item.name} ×{i.quantity}
                      </strong>
                      <small>Consome sua ação</small>
                    </span>
                  </button>
                )
              );
            })}
          </div>
        </>
      )}
      <div className="manual-techniques">
        {battle.techniques.map((technique) => {
          const art = techniqueArtwork[technique.id];
          const reason =
            technique.cooldownRemaining > 0
              ? `Recarga: ${technique.cooldownRemaining} rodada(s)`
              : technique.kiCost > battle.playerKi
                ? "Ki insuficiente"
                : technique.kiCost
                  ? `${technique.kiCost} Ki`
                  : "Sem custo de Ki";
          return (
            <button
              key={technique.id}
              className="manual-technique"
              aria-label={`Usar ${technique.name}`}
              disabled={busy || !technique.available}
              onClick={() =>
                onAction({
                  action: "battle.turn",
                  battleId: battle.id,
                  round: battle.round,
                  techniqueId: technique.id,
                })
              }
            >
              {art ? <ArtworkImage art={art} sizes="80px" /> : <Swords size={28} />}
              <span>
                <strong>{technique.name}</strong>
                <small>{reason}</small>
              </span>
              {busy && <LoaderCircle className="spin" size={16} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
