"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Settings,
  UserRound,
  Zap,
} from "lucide-react";
import type { GameSnapshot } from "@/game/types";
import type { ActionPayload } from "@/game/validation";
import { authClient } from "@/lib/auth-client";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordChangeSchema,
  profileNameSchema,
} from "@/lib/account-validation";
import { Brand, RaceEmblem } from "./brand";
import { CombatModeSelector } from "./combat-controls";
import { formatNumber } from "./game-primitives";

type Notice = { text: string; error: boolean };
type Operation = "name" | "password" | "combat";

function authError(error: { code?: string; status?: number }) {
  if (error.status === 429) return "Muitas tentativas. Aguarde um minuto e tente novamente.";
  switch (error.code) {
    case "INVALID_PASSWORD":
      return "A senha atual está incorreta.";
    case "PASSWORD_TOO_SHORT":
      return "A nova senha deve ter pelo menos 8 caracteres.";
    case "PASSWORD_TOO_LONG":
      return "A nova senha deve ter no máximo 128 caracteres.";
    case "INVALID_PROFILE_NAME":
      return "Informe um nome válido, com 2 a 60 caracteres.";
    case "SESSION_NOT_FRESH":
      return "Entre novamente na sua conta para alterar a senha.";
    default:
      return "Não foi possível salvar. Tente novamente.";
  }
}

export function AccountProfile({
  account,
  initial,
}: {
  account: { name: string; email: string };
  initial: GameSnapshot | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(account.name);
  const [savedName, setSavedName] = useState(account.name);
  const [snapshot, setSnapshot] = useState(initial);
  const [pending, setPending] = useState<Operation | null>(null);
  const [notices, setNotices] = useState<Partial<Record<Operation, Notice>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const locked = useRef(false);
  // Reabre o jogo com o estado persistido após editar a conta ou a preferência.
  function returnToGame(event: { preventDefault: () => void }) {
    event.preventDefault();
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Busca o estado atual sem reutilizar a rota de jogo em cache.
    window.location.assign("/jogo");
  }

  function notice(operation: Operation, text: string, error = false) {
    setNotices((previous) => ({ ...previous, [operation]: { text, error } }));
  }
  function begin(operation: Operation) {
    if (locked.current) return false;
    locked.current = true;
    setPending(operation);
    setNotices((previous) => ({ ...previous, [operation]: undefined }));
    return true;
  }
  function finish() {
    locked.current = false;
    setPending(null);
  }
  function expired(status?: number) {
    if (status !== 401) return false;
    router.replace("/login");
    router.refresh();
    return true;
  }
  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = profileNameSchema.safeParse(name);
    if (!parsed.success) {
      notice("name", parsed.error.issues[0].message, true);
      return;
    }
    if (!begin("name")) return;
    try {
      const result = await authClient.updateUser({ name: parsed.data });
      if (result.error) {
        if (!expired(result.error.status)) notice("name", authError(result.error), true);
        return;
      }
      setName(parsed.data);
      setSavedName(parsed.data);
      notice("name", "Nome da conta atualizado.");
    } catch {
      notice("name", "Falha na conexão. Tente novamente.", true);
    } finally {
      finish();
    }
  }
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const parsed = passwordChangeSchema.safeParse({
      currentPassword: values.get("currentPassword"),
      newPassword: values.get("newPassword"),
      confirmPassword: values.get("confirmPassword"),
    });
    if (!parsed.success) {
      notice("password", parsed.error.issues[0].message, true);
      return;
    }
    if (!begin("password")) return;
    try {
      const result = await authClient.changePassword({
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) {
        if (!expired(result.error.status)) notice("password", authError(result.error), true);
        return;
      }
      form.reset();
      setShowPassword(false);
      notice(
        "password",
        "Senha alterada. As outras sessões foram encerradas; você continua conectado aqui.",
      );
    } catch {
      notice("password", "Falha na conexão. Tente novamente.", true);
    } finally {
      finish();
    }
  }
  async function changeMode(payload: ActionPayload) {
    if (payload.action !== "combat.mode" || !snapshot || !begin("combat")) return;
    try {
      const response = await fetch("/api/game/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, idempotencyKey: crypto.randomUUID() }),
      });
      if (expired(response.status)) return;
      const data: { snapshot?: GameSnapshot; message?: string; error?: { message: string } } =
        await response.json();
      if (!response.ok || !data.snapshot) {
        notice(
          "combat",
          data.error?.message ?? "Não foi possível alterar o modo de combate.",
          true,
        );
        return;
      }
      setSnapshot(data.snapshot);
      notice("combat", data.message ?? "Preferência de combate salva.");
    } catch {
      notice("combat", "Falha na conexão. Tente novamente.", true);
    } finally {
      finish();
    }
  }
  function feedback(operation: Operation) {
    const value = notices[operation];
    return value ? (
      <p
        className={`profile-feedback ${value.error ? "error" : "success"}`}
        role={value.error ? "alert" : "status"}
      >
        {!value.error && <Check size={17} aria-hidden="true" />}
        {value.text}
      </p>
    ) : null;
  }

  return (
    <div className="profile-screen">
      <header className="game-header profile-header">
        <Link
          href="/jogo"
          prefetch={false}
          onNavigate={returnToGame}
          aria-label="Dragon Rush Z, voltar ao jogo"
        >
          <Brand />
        </Link>
        <Link
          href="/jogo"
          prefetch={false}
          onNavigate={returnToGame}
          className="button secondary small"
        >
          <ArrowLeft size={17} /> Voltar ao jogo
        </Link>
      </header>
      <main className="profile-main">
        <div className="profile-heading">
          <span className="eyebrow orange">SEU QUARTEL-GENERAL</span>
          <h1>
            <Settings aria-hidden="true" /> Perfil
          </h1>
          <p>Cuide da sua conta e prepare seu próximo combate.</p>
        </div>
        <div className="profile-grid">
          <section className="panel profile-card" aria-labelledby="profile-account-title">
            <h2 id="profile-account-title">
              <UserRound size={22} /> Sua conta
            </h2>
            <form onSubmit={saveName}>
              <label htmlFor="profile-name">Nome da conta</label>
              <input
                id="profile-name"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                maxLength={60}
                required
                disabled={pending !== null}
              />
              <p className="profile-hint">
                Como você se identifica no portal. O nome do guerreiro permanece o mesmo.
              </p>
              <label htmlFor="profile-email">Email da conta</label>
              <input
                id="profile-email"
                type="email"
                value={account.email}
                readOnly
                autoComplete="email"
              />
              <button className="button primary" disabled={pending !== null || name === savedName}>
                {pending === "name" ? (
                  <LoaderCircle size={18} className="spin" />
                ) : (
                  <Check size={18} />
                )}{" "}
                Salvar nome
              </button>
              {feedback("name")}
            </form>
          </section>
          <section className="panel profile-card" aria-labelledby="profile-password-title">
            <h2 id="profile-password-title">
              <KeyRound size={22} /> Alterar senha
            </h2>
            <p className="profile-hint">
              Confirme sua senha atual. A troca encerra suas sessões nos outros dispositivos.
            </p>
            <form onSubmit={changePassword}>
              <label htmlFor="profile-current-password">Senha atual</label>
              <input
                id="profile-current-password"
                name="currentPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                disabled={pending !== null}
              />
              <label htmlFor="profile-new-password">Nova senha</label>
              <input
                id="profile-new-password"
                name="newPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={PASSWORD_MAX_LENGTH}
                required
                disabled={pending !== null}
                aria-describedby="profile-password-hint"
              />
              <p className="profile-hint" id="profile-password-hint">
                Use de 8 a 128 caracteres.
              </p>
              <label htmlFor="profile-confirm-password">Confirmar nova senha</label>
              <input
                id="profile-confirm-password"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={PASSWORD_MAX_LENGTH}
                required
                disabled={pending !== null}
              />
              <button
                type="button"
                className="text-button profile-password-toggle"
                aria-pressed={showPassword}
                disabled={pending !== null}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                {showPassword ? "Ocultar senhas" : "Mostrar senhas"}
              </button>
              <button className="button primary" disabled={pending !== null}>
                {pending === "password" ? (
                  <LoaderCircle size={18} className="spin" />
                ) : (
                  <KeyRound size={18} />
                )}{" "}
                Alterar senha
              </button>
              {feedback("password")}
            </form>
          </section>
          <section
            className="panel profile-card profile-warrior"
            aria-labelledby="profile-warrior-title"
          >
            <h2 id="profile-warrior-title">
              <Zap size={22} /> Seu guerreiro
            </h2>
            {snapshot ? (
              <>
                <div className="profile-warrior-identity">
                  <span className="profile-race-emblem">
                    <RaceEmblem raceId={snapshot.race.id} />
                  </span>
                  <div>
                    <h3>{snapshot.character.name}</h3>
                    <p>
                      {snapshot.race.name} · Nível {snapshot.character.level}
                    </p>
                  </div>
                </div>
                <dl className="profile-warrior-stats">
                  <div>
                    <dt>Power Level</dt>
                    <dd>{formatNumber(snapshot.stats.powerLevel)}</dd>
                  </div>
                  <div>
                    <dt>Zeni</dt>
                    <dd>{formatNumber(snapshot.character.zeni)}</dd>
                  </div>
                </dl>
                <Link
                  href="/jogo"
                  prefetch={false}
                  onNavigate={returnToGame}
                  className="button secondary"
                >
                  <ArrowLeft size={17} /> Voltar à jornada
                </Link>
              </>
            ) : (
              <>
                <p>Seu guerreiro ainda está esperando por você. Escolha sua raça para começar.</p>
                <Link
                  href="/jogo"
                  prefetch={false}
                  onNavigate={returnToGame}
                  className="button primary"
                >
                  Criar personagem
                </Link>
              </>
            )}
          </section>
          {snapshot && (
            <div className="profile-combat">
              <CombatModeSelector
                snapshot={snapshot}
                busy={pending !== null}
                onAction={changeMode}
              />
              {feedback("combat")}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
