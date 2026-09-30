"use client";

import { ArrowRight, Compass, Dumbbell, Heart, Swords, Zap } from "lucide-react";
import type { GameSnapshot } from "@/game/types";
import { formatNumber } from "./game-primitives";

type Destination = "training" | "explore" | "battle" | "techniques";
type Props = {
  snapshot: GameSnapshot;
  busy: boolean;
  onNavigate: (destination: Destination) => void;
  onTrain: () => void;
  onRest: () => void;
};

const destinations = [
  {
    id: "training",
    title: "Treinamento",
    subtitle: "Fique mais forte",
    guide: "GOKU",
    icon: Dumbbell,
  },
  {
    id: "explore",
    title: "Explorar a Terra",
    subtitle: "Encontre seu próximo desafio",
    guide: "BULMA",
    icon: Compass,
  },
  {
    id: "battle",
    title: "Batalhar",
    subtitle: "Conquiste XP, Zeni e itens",
    guide: "VEGETA",
    icon: Swords,
  },
  { id: "techniques", title: "Técnicas", subtitle: "Domine o seu Ki", guide: "PICCOLO", icon: Zap },
] as const;

export function GameLobby({ snapshot, busy, onNavigate, onTrain, onRest }: Props) {
  const { character, stats, activity, catalog } = snapshot;
  const training = catalog.policies.find((policy) => policy.id === "training");
  const recovering = character.hp <= 0;
  return (
    <section className="game-lobby" aria-label="Início da jornada">
      <div className="lobby-hero">
        <div className="lobby-hero-art" aria-hidden="true">
          <span className="hero-fighter fighter-vegeta">
            <span>VEGETA</span>
          </span>
          <span className="hero-fighter fighter-piccolo">
            <span>PICCOLO</span>
          </span>
          <span className="hero-fighter fighter-goku">
            <span>GOKU</span>
          </span>
        </div>
        <div className="lobby-hero-copy">
          <span className="lobby-chapter">
            <span /> PLANETA TERRA · CAPÍTULO 01
          </span>
          <h1>
            ESCREVA A SUA
            <br />
            <em>LENDA.</em>
          </h1>
          <p>
            Seu poder não tem limites. Treine, explore a Terra e desafie os inimigos de Dragon Ball.
          </p>
          <div className="lobby-hero-actions">
            <button
              className="button primary"
              disabled={busy || Boolean(activity)}
              onClick={recovering ? onRest : onTrain}
            >
              {recovering ? <Heart size={19} /> : <Dumbbell size={19} />}
              {activity
                ? "Atividade em andamento"
                : recovering
                  ? "Recuperar minhas forças"
                  : "Treinar agora"}
              <ArrowRight size={18} />
            </button>
            <button className="button secondary" onClick={() => onNavigate("explore")}>
              <Compass size={18} /> Explorar a Terra
            </button>
          </div>
          <div className="lobby-player-summary">
            <span>
              <strong>{character.level}</strong> NÍVEL
            </span>
            <span>
              <strong>{formatNumber(stats.powerLevel)}</strong> POWER LEVEL
            </span>
            <span>
              <strong>{formatNumber(character.zeni)}</strong> ZENI
            </span>
          </div>
        </div>
        <span className="lobby-world-label">SUA JORNADA COMEÇA NA TERRA</span>
      </div>
      <div className="lobby-menu-heading">
        <h2>O que vamos fazer hoje?</h2>
        <span>ESCOLHA SEU PRÓXIMO PASSO</span>
      </div>
      <div className="lobby-menu">
        {destinations.map(({ id, title, subtitle, guide, icon: Icon }, index) => (
          <button
            key={id}
            className={`lobby-tile lobby-tile-${id}`}
            aria-label={`Abrir ${title.toLowerCase()}`}
            onClick={() => onNavigate(id)}
          >
            <span
              className="lobby-tile-art"
              style={{ backgroundPositionX: `${index * (100 / 3)}%` }}
              aria-hidden="true"
            />
            <span className="lobby-guide">
              <Icon size={13} /> {guide}
            </span>
            {id === "training" && training && (
              <span className="lobby-tile-reward">
                +{training.xpReward} XP · {training.durationSeconds}s
              </span>
            )}
            <span className="lobby-tile-copy">
              <strong>{title}</strong>
              <small>{subtitle}</small>
            </span>
            <span className="lobby-tile-arrow">
              <ArrowRight size={21} />
            </span>
          </button>
        ))}
      </div>
      <div className="lobby-next-level">
        <Zap size={17} />
        <p>
          <strong>{character.name}</strong>, faltam{" "}
          <strong>{formatNumber(snapshot.xpRequired - character.xp)} XP</strong> para o nível{" "}
          {character.level + 1}.
        </p>
        <span>UMA BATALHA DE CADA VEZ.</span>
      </div>
    </section>
  );
}
