"use client";
import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import type { GameSnapshot } from "@/game/types";
import type { RankingEntry } from "@/server/ranking";
import { formatNumber } from "./game-primitives";
export function RankingPanel({ snapshot }: { snapshot: GameSnapshot }) {
  const [race, setRace] = useState(""),
    [result, setResult] = useState<{
      entries: RankingEntry[];
      own: RankingEntry | null;
      total: number;
    } | null>(null),
    [error, setError] = useState(false),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/game/ranking${race ? `?race=${encodeURIComponent(race)}` : ""}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("ranking");
        return response.json();
      })
      .then((data) => {
        setResult(data);
        setError(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(true);
      });
    return () => controller.abort();
  }, [race, refresh]);
  return (
    <section className="panel rpg-ranking">
      <div className="rpg-heading">
        <span className="eyebrow orange">SUPERE SEUS LIMITES</span>
        <h2>
          <Trophy size={28} /> Ranking de Power Level
        </h2>
        <p>
          Seu poder permanente, sua build e seus equipamentos. Poções e efeitos temporários não
          alteram a classificação.
        </p>
      </div>
      <div className="rpg-actions">
        <label>
          Classificação
          <select
            aria-label="Filtrar ranking por raça"
            value={race}
            onChange={(e) => {
              setRace(e.target.value);
              setResult(null);
            }}
          >
            <option value="">Todas as raças</option>
            {snapshot.catalog.races.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <button className="button secondary small" onClick={() => setRefresh(refresh + 1)}>
          Atualizar ranking
        </button>
      </div>
      {error ? (
        <p role="alert">Não foi possível carregar a classificação. Tente atualizar.</p>
      ) : !result ? (
        <p>Consultando os guerreiros da Terra…</p>
      ) : (
        <>
          {result.own && (
            <div className="rpg-own-rank">
              Sua posição: <strong>#{result.own.position}</strong> ·{" "}
              {formatNumber(result.own.powerLevel)} PL
            </div>
          )}
          <div className="rpg-ranking-scroll">
            <table>
              <thead>
                <tr>
                  <th>Posição</th>
                  <th>Guerreiro</th>
                  <th>Raça</th>
                  <th>Nível</th>
                  <th>Power Level</th>
                  <th>Capítulos</th>
                </tr>
              </thead>
              <tbody>
                {result.entries.map((r, index) => (
                  <tr key={`${r.position}-${index}`} className={r.own ? "own" : ""}>
                    <td>#{r.position}</td>
                    <td>
                      {r.name}
                      {r.own && <small> VOCÊ</small>}
                    </td>
                    <td>{snapshot.catalog.races.find((race) => race.id === r.raceId)?.name}</td>
                    <td>{r.level}</td>
                    <td>{formatNumber(r.powerLevel)}</td>
                    <td>{r.chapters}/6</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <small>
            {result.total} guerreiro(s). Exibindo os primeiros 50; empates de PL, capítulos e nível
            compartilham posição.
          </small>
        </>
      )}
    </section>
  );
}
