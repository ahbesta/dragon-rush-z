import type { CSSProperties } from "react";
import { Crosshair, Heart, Zap } from "lucide-react";
import type { Attributes, DerivedStats, RaceDefinition } from "@/game/types";
import { attributeKeys } from "@/game/builds";
import { attributeIcons, attributeLabels, formatNumber } from "./game-primitives";

export const attributePurposes = {
  strength: "Potência dos golpes físicos",
  defense: "Proteção contra ataques",
  speed: "Ordem de iniciativa",
  endurance: "Vida e resistência a efeitos",
  kiControl: "Reserva e potência de Ki",
};

export function FighterAttributes({
  race,
  attributes,
  base,
  stats,
  initial = false,
}: {
  race: RaceDefinition;
  attributes: Attributes;
  base?: Attributes;
  stats: DerivedStats;
  initial?: boolean;
}) {
  const values = attributeKeys.map((key) => attributes[key] ?? 0);
  const maximum = Math.max(1, ...values);
  const strongestAffinity = Math.max(...attributeKeys.map((key) => race.affinities?.[key] ?? 1));
  const point = (index: number, radius: number) => {
    const angle = ((-90 + index * 72) * Math.PI) / 180;
    return `${110 + Math.cos(angle) * radius},${110 + Math.sin(angle) * radius}`;
  };
  return (
    <section
      className={`fighter-attributes${initial ? " origin-attributes" : ""}`}
      aria-label={initial ? "Atributos iniciais da raça" : "Atributos do guerreiro"}
      style={{ "--origin-color": race.color } as CSSProperties}
    >
      <header className="fighter-attributes-header">
        <div>
          <span className="eyebrow">
            SCOUTER · {initial ? "POTENCIAL DE ORIGEM" : "LEITURA DO GUERREIRO"}
          </span>
          <h3>
            <Crosshair size={22} />
            {initial ? "Seu poder começa aqui" : "Seus atributos"}
          </h3>
        </div>
        <span className="fighter-scouter-tag">
          <i />
          {race.name}
        </span>
      </header>
      <div className="fighter-attributes-body">
        <div className="fighter-scouter">
          <div className="fighter-power-reading">
            <span>POWER LEVEL{initial ? " INICIAL" : ""}</span>
            <strong>{formatNumber(stats.powerLevel)}</strong>
            <small>
              {initial
                ? "Antes de distribuir seus pontos"
                : "Calculado com seus atributos e equipamentos"}
            </small>
          </div>
          <svg
            viewBox="0 0 220 220"
            role="img"
            aria-label="Perfil relativo dos cinco atributos; os números ao lado mostram os valores reais."
          >
            {[24, 48, 72].map((radius) => (
              <polygon
                className="scouter-grid"
                key={radius}
                points={attributeKeys.map((_, index) => point(index, radius)).join(" ")}
              />
            ))}
            {attributeKeys.map((key, index) => (
              <line
                className="scouter-axis"
                key={key}
                x1="110"
                y1="110"
                x2={point(index, 72).split(",")[0]}
                y2={point(index, 72).split(",")[1]}
              />
            ))}
            <polygon
              className="scouter-profile"
              points={values.map((value, index) => point(index, (72 * value) / maximum)).join(" ")}
            />
            {attributeKeys.map((key, index) => {
              const [x, y] = point(index, 96).split(",");
              return (
                <text key={key} x={x} y={Number(y) + 4} textAnchor="middle">
                  {["FOR", "DEF", "VEL", "RES", "KI"][index]}
                </text>
              );
            })}
          </svg>
          <div className="fighter-resource-readings">
            <span>
              <Heart size={15} />
              <strong>{formatNumber(stats.maxHp)}</strong> HP máx.
            </span>
            <span>
              <Zap size={15} />
              <strong>{formatNumber(stats.maxKi)}</strong> Ki máx.
            </span>
          </div>
          <small className="fighter-profile-caption">
            Perfil proporcional · não representa um limite
          </small>
        </div>
        <div className="fighter-attribute-cards">
          {attributeKeys.map((key, index) => {
            const Icon = attributeIcons[key];
            const affinity = race.affinities?.[key] ?? 1;
            const bonus = base ? (attributes[key] ?? 0) - (base[key] ?? 0) : 0;
            return (
              <article
                key={key}
                className={`fighter-attribute-card${affinity === strongestAffinity && affinity > 1 ? " affinity-specialty" : ""}`}
              >
                <span className="fighter-attribute-icon">
                  <Icon size={23} />
                </span>
                <div className="fighter-attribute-copy">
                  <span className="fighter-attribute-code">
                    0{index + 1} / {key === "kiControl" ? "ENERGIA" : "COMBATE"}
                  </span>
                  <h4>{attributeLabels[key]}</h4>
                  <p>{attributePurposes[key]}</p>
                </div>
                <div className="fighter-attribute-value">
                  <strong>{formatNumber(attributes[key] ?? 0)}</strong>
                  {base && (
                    <small>
                      Base {formatNumber(base[key] ?? 0)}
                      {bonus !== 0 && (
                        <span>
                          {" "}
                          {bonus > 0 ? "+" : ""}
                          {formatNumber(bonus)} bônus
                        </span>
                      )}
                    </small>
                  )}
                </div>
                <span className="fighter-affinity">
                  Afinidade <b>×{affinity.toLocaleString("pt-BR")}</b>
                  {affinity === strongestAffinity && affinity > 1 && (
                    <small> ESPECIALIDADE RACIAL</small>
                  )}
                </span>
              </article>
            );
          })}
        </div>
      </div>
      <footer className="fighter-attributes-footnote">
        {initial
          ? "A raça define sua base. Seus pontos definem o caminho."
          : "Base + bônus equipados. Afinidades potencializam os pontos investidos."}
      </footer>
    </section>
  );
}
