import { redirect } from "next/navigation";
import { currentSession } from "@/server/auth";
import { getDatabase } from "@/server/db/client";
import { readSnapshot } from "@/server/game-service";
import { readCatalog } from "@/server/catalog";
import { GameShell } from "@/components/game-shell";
import { CharacterCreation } from "@/components/character-creation";
export const dynamic = "force-dynamic";
export default async function Game() {
  const session = await currentSession();
  if (!session) redirect("/login");
  const { db } = getDatabase();
  const snapshot = await readSnapshot(db, session.user.id);
  if (!snapshot) {
    const catalog = await readCatalog(db);
    return <CharacterCreation races={catalog.races} />;
  }
  return <GameShell initial={snapshot} />;
}
