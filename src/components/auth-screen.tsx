"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, Swords, Zap, LoaderCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Brand, DragonBall } from "./brand";

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
    <main className="auth-layout">
      <section className="auth-art">
        <Brand light />
        <div className="auth-orbit">
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <DragonBall stars={4} className="hero-ball" />
          <span className="orbit-label">PODER SEM LIMITES.</span>
        </div>
        <div className="auth-story">
          <span className="eyebrow">UM NOVO GUERREIRO. UMA NOVA HISTÓRIA.</span>
          <h1>
            O próximo capítulo
            <br />
            começa com <em>você.</em>
          </h1>
          <p>
            Escolha sua raça. Domine seu Ki. Explore a Terra.
            <br />E descubra até onde seu poder pode chegar.
          </p>
          <div className="auth-features">
            <span>
              <Swords size={17} /> COMBATES
            </span>
            <span>
              <Zap size={17} /> EVOLUÇÃO
            </span>
            <span>
              <ShieldCheck size={17} /> EXPLORAÇÃO
            </span>
          </div>
        </div>
      </section>
      <section className="auth-form-side">
        <span className="auth-edition">
          DRAGON RUSH Z <span>PRIMEIRA JORNADA</span>
        </span>
        <div className="auth-form-wrap">
          <span className="eyebrow orange">PRONTO PARA SUPERAR SEUS LIMITES?</span>
          <h2>{mode === "login" ? "Bem-vindo de volta." : "Sua lenda começa aqui."}</h2>
          <p>
            {mode === "login"
              ? "Entre na sua conta e continue sua jornada."
              : "Crie sua conta para entrar no mundo de Dragon Ball."}
          </p>
          <div className="auth-tabs">
            <button
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Entrar
            </button>
            <button
              className={mode === "signup" ? "active" : ""}
              onClick={() => {
                setMode("signup");
                setError("");
              }}
            >
              Criar conta
            </button>
          </div>
          <form onSubmit={submit}>
            {mode === "signup" && (
              <label>
                Seu nome
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={50}
                  placeholder="Como podemos chamar você?"
                  autoComplete="name"
                />
              </label>
            )}
            <label>
              Email
              <input
                name="email"
                type="email"
                required
                placeholder="voce@email.com"
                autoComplete="email"
              />
            </label>
            <label>
              Senha
              <input
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={128}
                placeholder="Pelo menos 8 caracteres"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </label>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button className="button primary auth-submit" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={19} />
              ) : (
                <>
                  {mode === "login" ? "Entrar no jogo" : "Criar minha conta"}
                  <ArrowRight size={19} />
                </>
              )}
            </button>
          </form>
          <div className="auth-foot">
            <span className="status-dot" /> SEU PROGRESSO CONTINUA DE ONDE VOCÊ PAROU.
          </div>
        </div>
        <footer>
          Um RPG de navegador no universo de Dragon Ball.
          <br />
          <span>Treine hoje. Fique mais forte amanhã.</span>
        </footer>
      </section>
    </main>
  );
}
