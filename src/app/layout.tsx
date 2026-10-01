import type { Metadata } from "next";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/500.css";
import "./globals.css";
import "./game-theme.css";
import "./artwork.css";
import "./combat.css";
import "./battle-arena.css";
import "./activity-animation.css";
import "./world-map.css";
import "./world-map-ambience.css";
import "./profile.css";
export const metadata: Metadata = {
  title: "Dragon Rush Z • Sua jornada começa agora",
  description:
    "RPG de navegador de fã de Dragon Ball. Treine, explore a Terra e supere seus limites.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
