"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronsRight, LoaderCircle, LockKeyhole, Mail, Star, UserRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email"));
    const password = String(data.get("password"));
    try {
      const response =
        mode === "login"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({
              email,
              password,
              name: String(data.get("name")).trim(),
            });
      if (response.error) {
        setError(
          mode === "login"
            ? "Email ou senha inválidos. Verifique e tente novamente."
            : "Não foi possível criar a conta. Confira os dados ou tente fazer login.",
        );
        return;
      }
      router.push("/jogo");
      router.refresh();
    } catch {
      setError("Não foi possível conectar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="entry-screen" data-mode={mode}>
      <div className="entry-scenery" aria-hidden="true">
        <Image
          src="/images/login/nimbus-journey.webp"
          alt=""
          width={1672}
          height={941}
          sizes="(max-width: 700px) 150vw, 100vw"
          preload
          className="entry-illustration"
        />
      </div>
      <header className="entry-masthead">
        <div>
          <h1 className="entry-logo" aria-label="Dragon Rush Z">
            <span>DRAGON</span> <span className="entry-logo-rush">RUSH</span> <b>Z</b>
          </h1>
          <p>UMA JORNADA NO UNIVERSO DE DRAGON BALL</p>
        </div>
        <span className="entry-edition">RPG DE NAVEGADOR</span>
      </header>
      <div className="entry-content">
        <div className="entry-invitation">
          <span>A AVENTURA ESTÁ SÓ COMEÇANDO</span>
          <p>
            O mundo é grande.
            <br />
            Seu potencial também.
          </p>
        </div>
        <section className="entry-panel" aria-labelledby="entry-form-title">
          <div className="entry-panel-heading">
            <div>
              <span className="entry-chapter">
                {mode === "login" ? "DE VOLTA À AVENTURA" : "UMA NOVA JORNADA"}
              </span>
              <h2 id="entry-form-title">
                {mode === "login" ? "Continue sua jornada." : "Prepare-se, guerreiro."}
              </h2>
            </div>
            <span className="entry-seal" aria-hidden="true">
              {Array.from({ length: 4 }, (_, index) => (
                <Star key={index} fill="currentColor" strokeWidth={0} />
              ))}
            </span>
          </div>
          <p>
            {mode === "login"
              ? "Sua próxima conquista está logo ali."
              : "Crie sua conta e encontre seu próprio caminho."}
          </p>
          <div className="entry-switch" role="group" aria-label="Acesso ao jogo">
            <button
              type="button"
              aria-pressed={mode === "login"}
              disabled={busy}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Entrar
            </button>
            <button
              type="button"
              aria-pressed={mode === "signup"}
              disabled={busy}
              onClick={() => {
                setMode("signup");
                setError("");
              }}
            >
              Criar conta
            </button>
          </div>
          <form onSubmit={submit} aria-busy={busy}>
            {mode === "signup" && (
              <label className="entry-field">
                Seu nome
                <span className="entry-input">
                  <UserRound size={18} aria-hidden="true" />
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={50}
                    placeholder="Como podemos chamar você?"
                    autoComplete="name"
                  />
                </span>
              </label>
            )}
            <label className="entry-field">
              Email
              <span className="entry-input">
                <Mail size={18} aria-hidden="true" />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="voce@email.com"
                  autoComplete="email"
                />
              </span>
            </label>
            <label className="entry-field">
              Senha
              <span className="entry-input">
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  placeholder="Pelo menos 8 caracteres"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </span>
            </label>
            {error && (
              <p role="alert" className="entry-error">
                {error}
              </p>
            )}
            <button className="entry-submit" disabled={busy}>
              {busy ? (
                <>
                  {mode === "login" ? "Entrando…" : "Criando conta…"}
                  <LoaderCircle className="entry-spinner" size={22} aria-hidden="true" />
                </>
              ) : (
                <>
                  {mode === "login" ? "Entrar no jogo" : "Criar minha conta"}
                  <ChevronsRight size={24} aria-hidden="true" />
                </>
              )}
            </button>
          </form>
          <p className="entry-save-note">
            <Star size={13} aria-hidden="true" />
            Sua jornada fica salva. Volte quando quiser.
          </p>
        </section>
      </div>
      <footer className="entry-footer">
        <span>Uma aventura de fã. Um universo de possibilidades.</span>
        <span>TREINE. LUTE. SUPERE.</span>
      </footer>
    </main>
  );
}
