"use client";
import { AlertTriangle } from "lucide-react";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="error-screen">
      <AlertTriangle size={40} />
      <h1>O radar perdeu o sinal.</h1>
      <p>Não foi possível carregar o jogo. Verifique a conexão e tente novamente.</p>
      <button className="button primary" onClick={reset}>
        Tentar novamente
      </button>
    </main>
  );
}
