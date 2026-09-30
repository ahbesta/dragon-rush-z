import Link from "next/link";
export default function NotFound() {
  return (
    <main className="error-screen">
      <span className="eyebrow">404 • FORA DO RADAR</span>
      <h1>Essa área ainda não foi descoberta.</h1>
      <Link className="button primary" href="/jogo">
        Voltar ao jogo
      </Link>
    </main>
  );
}
