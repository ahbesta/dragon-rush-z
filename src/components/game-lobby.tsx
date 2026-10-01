"use client";

import { ArrowRight, Dumbbell, Heart, Zap } from "lucide-react";
import type { GameSnapshot } from "@/game/types";
import type { MapNavigation } from "@/lib/world-map";
import { formatNumber } from "./game-primitives";
import { WorldMap } from "./world-map";

type Props = {
  snapshot: GameSnapshot;
  busy: boolean;
  onNavigate: (destination: MapNavigation) => void;
  onAreaSelect: (mode: "battle" | "explore", areaId: string) => void;
  onCharacter: () => void;
  onTrain: () => void;
  onRest: () => void;
};

export function GameLobby(props: Props) {
  const { snapshot, busy, onTrain, onRest } = props;
  const { character, activity } = snapshot;
  const recovering = character.hp <= 0;
  return (
    <section className="game-lobby" aria-label="Início da jornada">
      <WorldMap {...props} />
      <div className="world-map-journey">
        <div>
          <Zap size={19} />
          <p>
            <strong>{character.name}</strong>, faltam{" "}
            <strong>{formatNumber(snapshot.xpRequired - character.xp)} XP</strong> para o nível{" "}
            {character.level + 1}.
          </p>
        </div>
        <button
          className="button primary small"
          disabled={busy || Boolean(activity) || Boolean(snapshot.activeBattle)}
          onClick={recovering ? onRest : onTrain}
        >
          {recovering ? <Heart size={17} /> : <Dumbbell size={17} />}
          {activity
            ? "Atividade em andamento"
            : recovering
              ? "Recuperar minhas forças"
              : "Treinar agora"}
          <ArrowRight size={16} />
        </button>
      </div>
    </section>
  );
}
