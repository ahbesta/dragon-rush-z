"use client";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  Clock3,
  Dumbbell,
  Heart,
  LockKeyhole,
  MapPin,
  Sparkles,
  Zap,
} from "lucide-react";
import type { GameSnapshot } from "@/game/types";
import type { ActionPayload } from "@/game/validation";
import { unmetRequirements } from "@/game/requirements";
import {
  trainingProgress,
  trainingMaxSeconds,
  trainingMinSeconds,
  formatTrainingTime,
  trainingHourlyXp,
} from "@/game/training";
import { trainingArtwork, destinationArtwork } from "@/lib/game-art";
import { ArtworkImage } from "./artwork-image";
import { ActivityAnimation } from "./activity-animation";
import { formatNumber as n, Meter } from "./game-primitives";

export function TrainingPanel({
  snapshot,
  now,
  busy,
  blocked,
  onAction,
}: {
  snapshot: GameSnapshot;
  now: number;
  busy: boolean;
  blocked: boolean;
  onAction: (payload: ActionPayload) => void;
}) {
  const { catalog, activity, character, stats } = snapshot;
  const [selectedId, setSelectedId] = useState(
    activity?.training?.trainingId ?? catalog.trainings[0]?.id,
  );
  const selected = catalog.trainings.find((t) => t.id === selectedId) ?? catalog.trainings[0];
  if (!selected) return <p role="alert">Nenhum treinamento disponível.</p>;
  const art = trainingArtwork[selected.artId] ?? trainingArtwork.kame;
  const master = catalog.masters.find((m) => m.id === selected.masterId)?.name ?? selected.masterId;
  const context = {
    level: character.level,
    powerLevel: stats.powerLevel,
    raceId: character.raceId,
    flags: character.flags,
  };
  const reasons = unmetRequirements(selected.requirements, context);
  const idle = activity?.training
    ? trainingProgress(activity.training, activity.finishesAt, now)
    : null;
  const activeHere = activity?.training?.trainingId === selected.id;
  const hourlyXp =
    activeHere && activity?.training
      ? activity.training.xpPerHour
      : trainingHourlyXp(selected, character.level);
  const remaining = activity
    ? Math.max(0, Math.ceil((Date.parse(activity.finishesAt) - now) / 1000))
    : 0;
  const rest = catalog.policies.find((p) => p.id === "rest")!;
  const unlocks = [
    ...(selected.requirements.minLevel
      ? [
          {
            id: "level",
            label: `Nível ${selected.requirements.minLevel}`,
            done: character.level >= selected.requirements.minLevel,
          },
        ]
      : []),
    ...(selected.requirements.minPower
      ? [
          {
            id: "power",
            label: `Power Level ${n(selected.requirements.minPower)}`,
            done: stats.powerLevel >= selected.requirements.minPower,
          },
        ]
      : []),
    ...(selected.requirements.masterId
      ? [
          {
            id: "master",
            label: `Ser aluno de ${catalog.masters.find((m) => m.id === selected.requirements.masterId)?.name ?? selected.requirements.masterId}`,
            done: character.flags.includes(`master:${selected.requirements.masterId}`),
          },
        ]
      : []),
    ...(selected.requirements.raceIds?.length
      ? [
          {
            id: "race",
            label: `Raça: ${selected.requirements.raceIds.map((id) => catalog.races.find((r) => r.id === id)?.name ?? id).join(" / ")}`,
            done: selected.requirements.raceIds.includes(character.raceId),
          },
        ]
      : []),
    ...(selected.requirements.flags ?? []).map((flag) => ({
      id: flag,
      done: character.flags.includes(flag),
      label: flag.startsWith("defeated:")
        ? `Vencer ${catalog.enemies.find((e) => e.id === flag.slice(9))?.name ?? flag.slice(9)}`
        : flag.startsWith("quest:")
          ? `Concluir: ${catalog.quests.find((q) => q.id === flag.slice(6))?.name ?? flag.slice(6)}`
          : flag,
    })),
  ];
  return (
    <div className="idle-training">
      <div className="training-route-heading">
        <span className="eyebrow orange">ESCOLHA SEU MESTRE</span>
        <span>
          <Clock3 size={14} /> OFFLINE · ATÉ 24H
        </span>
      </div>
      <nav className="training-route" aria-label="Locais de treinamento">
        {catalog.trainings.map((training, index) => {
          const locked = unmetRequirements(training.requirements, context).length > 0;
          const scene = trainingArtwork[training.artId] ?? trainingArtwork.kame;
          const selected = training.id === selectedId;
          return (
            <button
              key={training.id}
              className={`training-stop${selected ? " selected" : ""}${locked ? " locked" : ""}`}
              aria-pressed={selected}
              onClick={() => setSelectedId(training.id)}
            >
              <span className="training-stop-art">
                <ArtworkImage art={scene.still} sizes="90px" />
              </span>
              <span className="training-stop-copy">
                <small>
                  {String(index + 1).padStart(2, "0")} · {training.location}
                </small>
                <strong>{catalog.masters.find((m) => m.id === training.masterId)?.name}</strong>
                <span>
                  <Zap size={13} />
                  {n(trainingHourlyXp(training, character.level))} XP/h
                </span>
              </span>
              {locked ? (
                <LockKeyhole size={17} aria-label="Treinamento bloqueado" />
              ) : (
                <ArrowRight size={17} />
              )}
            </button>
          );
        })}
      </nav>
      <div className="training-grid idle-training-grid">
        <section
          className="training-stage"
          key={selected.id}
          aria-label={`Treinamento: ${selected.name}`}
        >
          <div className="training-stage-scene">
            {activeHere && remaining > 0 ? (
              <ActivityAnimation
                kind="training"
                remaining={remaining}
                duration={trainingMaxSeconds}
                fallbackArt={art.still}
                artwork={art.animation}
                caption={`TREINO · ${master.toUpperCase()}`}
              />
            ) : (
              <ArtworkImage art={art.still} sizes="(max-width: 900px) 95vw, 65vw" />
            )}
            <div className="training-scene-footer">
              <span className="training-location-tag">
                <MapPin size={14} />
                {selected.location}
              </span>
              {reasons.length > 0 && !activeHere && (
                <span className="training-seal">
                  <LockKeyhole size={18} />
                  DESAFIO PENDENTE
                </span>
              )}
            </div>
          </div>
          <div className="training-stage-window">
            <span className="eyebrow orange">{master.toUpperCase()}</span>
            <h2>{selected.name}</h2>
            <p>{selected.description}</p>
            {activeHere && idle ? (
              <div className="training-accrual" aria-label="XP acumulado no treino" role="status">
                <span className="training-xp-orb">
                  <Zap size={27} />
                </span>
                <div>
                  <small>{idle.capped ? "LIMITE ATINGIDO · COLETE SEU XP" : "XP ACUMULANDO"}</small>
                  <strong>
                    +{n(idle.xp)} <span>XP</span>
                  </strong>
                  {!idle.capped && (
                    <span className="training-next-xp">
                      Próximo XP em {formatTrainingTime(idle.nextXpInSeconds)}
                    </span>
                  )}
                </div>
                <span className="training-clock">
                  <Clock3 size={15} />
                  {formatTrainingTime(idle.seconds)}
                  <small>/ 24:00:00</small>
                </span>
                <div
                  className="training-cap-meter"
                  role="progressbar"
                  aria-label="Tempo de treinamento"
                  aria-valuenow={idle.seconds}
                  aria-valuemin={0}
                  aria-valuemax={trainingMaxSeconds}
                >
                  <span style={{ width: `${(idle.seconds / trainingMaxSeconds) * 100}%` }} />
                </div>
              </div>
            ) : (
              <div className="training-yield">
                <span>
                  <Zap size={18} />
                  <strong>{n(hourlyXp)}</strong> XP/h
                </span>
                <span>
                  <Clock3 size={16} />
                  {selected.levelRatePercent}% DO XP DO NÍVEL/h
                </span>
                <span>
                  ATÉ <strong>{n(hourlyXp * 24)}</strong> XP/24h
                </span>
              </div>
            )}
            {reasons.length > 0 && !activeHere ? (
              <div className="training-unlocks">
                <strong>
                  <LockKeyhole size={17} />
                  Prove seu poder para treinar aqui
                </strong>
                <ul>
                  {unlocks.map((step) => (
                    <li key={step.id} className={step.done ? "done" : "pending"}>
                      {step.done ? <Check size={16} /> : <Dumbbell size={16} />}
                      {step.label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : activeHere && idle ? (
              <>
                <button
                  className="button primary training-start"
                  disabled={busy || !idle.canCollect}
                  onClick={() => onAction({ action: "activity.finish", activityId: activity!.id })}
                >
                  <Zap size={18} />
                  {idle.canCollect
                    ? `Coletar ${n(idle.xp)} XP e encerrar`
                    : `Coleta em ${Math.max(0, trainingMinSeconds - idle.seconds)}s`}
                </button>
                <small className="training-footnote">
                  Coletar encerra esta sessão. Após 24h, o XP para de acumular.
                </small>
              </>
            ) : (
              <>
                <button
                  className="button primary training-start"
                  disabled={blocked}
                  onClick={() => onAction({ action: "training.start", trainingId: selected.id })}
                >
                  <Dumbbell size={18} />
                  Iniciar treinamento
                </button>
                <small className="training-footnote">
                  Continua offline · coleta após 5 min · limite de 24h
                </small>
              </>
            )}
            {activity?.training && !activeHere && (
              <p className="training-other-active">
                Já está treinando em outro local.{" "}
                <button onClick={() => setSelectedId(activity.training!.trainingId)}>
                  Voltar ao treino <ArrowRight size={14} />
                </button>{" "}
                Colete antes de trocar.
              </p>
            )}
            {!activity && (snapshot.activeBattle || snapshot.activeExploration) && (
              <p className="training-other-active">
                Encerre {snapshot.activeBattle ? "a batalha" : "a expedição"} antes de treinar.
              </p>
            )}
          </div>
        </section>
        <div className="training-recovery-column">
          <section className="panel recovery-card">
            <div
              className={`activity-art recovery-art${activity?.kind === "rest" && remaining > 0 ? " activity-art-active" : ""}`}
            >
              {activity?.kind === "rest" && remaining > 0 ? (
                <ActivityAnimation
                  kind="rest"
                  remaining={remaining}
                  duration={rest.durationSeconds}
                  fallbackArt={destinationArtwork.rest}
                />
              ) : (
                <ArtworkImage art={destinationArtwork.rest} sizes="(max-width: 900px) 90vw, 30vw" />
              )}
            </div>
            <h3>Recupere suas forças</h3>
            <div className="recovery-meters">
              <Meter label="HP" value={character.hp} max={stats.maxHp} />
              <Meter label="Ki" value={character.ki} max={stats.maxKi} variant="ki" />
            </div>
            <button
              className="button secondary"
              disabled={blocked}
              onClick={() => onAction({ action: "rest.start" })}
            >
              <Heart size={16} />
              Descansar por {rest.durationSeconds}s
            </button>
            <span className="free-tag">GRATUITO · HP E KI COMPLETOS</span>
            {activity?.training && (
              <small className="training-footnote">Colete o treino antes de descansar.</small>
            )}
          </section>
          <section className="training-tip">
            <Sparkles size={22} />
            <div>
              <strong>Disciplina que vira poder</strong>
              <p>O XP fica aqui até você coletar. Seu guerreiro treina mesmo com o jogo fechado.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
