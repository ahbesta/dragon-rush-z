import { Star } from "lucide-react";

const raceEmblems: Record<string, string> = {
  saiyajin: "悟",
  humano: "人",
  namekuseijin: "龍",
  majin: "魔",
  freeza: "帝",
};

export function RaceEmblem({ raceId }: { raceId: string }) {
  return <span aria-hidden="true">{raceEmblems[raceId] ?? "武"}</span>;
}

export function DragonBall({ stars = 4, className = "" }: { stars?: number; className?: string }) {
  return (
    <span className={`dragon-ball ${className}`} aria-hidden="true">
      <span className="ball-stars">
        {Array.from({ length: stars }, (_, i) => (
          <Star key={i} fill="currentColor" strokeWidth={0} />
        ))}
      </span>
    </span>
  );
}
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? "light" : ""}`}>
      <DragonBall stars={4} />
      <div>
        <span>
          DRAGON RUSH<span className="brand-z">Z</span>
        </span>
        <small>SUPERE SEUS LIMITES</small>
      </div>
    </div>
  );
}
