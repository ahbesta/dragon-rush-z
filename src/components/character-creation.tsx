"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, LogOut, Shield, LoaderCircle, Settings } from "lucide-react";
import type { RaceDefinition } from "@/game/types";
import { authClient } from "@/lib/auth-client";
import { Brand } from "./brand";
import { raceArtwork } from "@/lib/game-art";
import { ArtworkImage } from "./artwork-image";
const labels = {
  strength: "Força",
  defense: "Defesa",
  speed: "Velocidade",
  endurance: "Resistência",
  kiControl: "Controle de Ki",
};
export function CharacterCreation({ races }: { races: RaceDefinition[] }) {
  const [raceId, setRaceId] = useState(races[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const race = races.find((r) => r.id === raceId);
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/game/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(new FormData(event.currentTarget).get("name")),
          raceId,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error?.message ?? "Não foi possível criar o personagem.");
        return;
      }
      window.scrollTo(0, 0);
      router.refresh();
    } catch {
      setError("Falha na conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="creation-screen">
      <header className="creation-header">
        <Brand />
        <div className="creation-account-actions">
          <Link
            href="/perfil"
            prefetch={false}
            className="text-button"
            onNavigate={(event) => {
              event.preventDefault();
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Perfil precisa de uma nova leitura da sessão e do personagem.
              window.location.assign("/perfil");
            }}
          >
            <Settings size={16} /> Perfil
          </Link>
          <button
            className="text-button"
            onClick={async () => {
              await authClient.signOut();
              router.push("/login");
            }}
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      </header>
      <div className="creation-content">
        <span className="eyebrow orange">01 / CRIAÇÃO DE PERSONAGEM</span>
        <h1>
          Todo poder tem uma <em>origem.</em>
        </h1>
        <p>Escolha quem você será. O resto da história é seu.</p>
        <form onSubmit={create}>
          <label className="character-name">
            Nome do guerreiro
            <input
              name="name"
              required
              minLength={3}
              maxLength={24}
              placeholder="Ex.: Rafael"
              autoComplete="off"
            />
            <small>De 3 a 24 caracteres. Um personagem por conta.</small>
          </label>
          <div className="section-title">
            <h2>Escolha sua raça</h2>
            <span>05 ORIGENS DISPONÍVEIS</span>
          </div>
          <div className="race-grid">
            {races.map((r, index) => {
              const art = raceArtwork[r.id];
              return (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => setRaceId(r.id)}
                  className={`race-card ${raceId === r.id ? "selected" : ""}`}
                  style={{ "--race-color": r.color } as React.CSSProperties}
                >
                  <span className="race-index">0{index + 1}</span>
                  <span className={art ? "race-portrait" : "race-emblem"}>
                    {art ? (
                      <ArtworkImage
                        art={art}
                        sizes="(max-width: 700px) 40vw, 20vw"
                        fallback={<Shield size={28} />}
                      />
                    ) : (
                      <Shield size={28} />
                    )}
                  </span>
                  <h3>{r.name}</h3>
                  <small>{r.trait}</small>
                  <span className="race-check">{raceId === r.id && <Check size={16} />}</span>
                </button>
              );
            })}
          </div>
          {race && (
            <div className="race-details">
              <div>
                <span className="eyebrow">SEU POTENCIAL INICIAL</span>
                <h2>{race.name}</h2>
                <p>{race.description}</p>
              </div>
              <div className="race-attrs">
                {Object.entries({ ...race.base, kiControl: race.kiBase ?? 10 }).map(
                  ([key, value]) => (
                    <div key={key}>
                      <span>{labels[key as keyof typeof labels]}</span>
                      <strong>{value}</strong>
                      <small>Afinidade ×{race.affinities?.[key as keyof typeof labels] ?? 1}</small>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="creation-bottom">
            <p>
              Sua raça define os atributos iniciais e as afinidades. Você distribui cinco pontos por
              nível.
              <br />
              <strong>Escolha com cuidado: sua origem é permanente.</strong>
            </p>
            <button className="button primary" disabled={busy || !race}>
              {busy ? (
                <LoaderCircle className="spin" />
              ) : (
                <>
                  Começar minha jornada
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      <footer className="creation-footer">PLANETA TERRA • SUA AVENTURA COMEÇA AQUI</footer>
    </main>
  );
}
