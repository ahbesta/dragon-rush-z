import { gameRequest } from "@/server/http";
import { readRanking } from "@/server/ranking";
import { readCatalog } from "@/server/catalog";
import { GameError } from "@/server/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return gameRequest(request, false, async ({ db, userId }) => {
    const raceId = new URL(request.url).searchParams.get("race");
    if (raceId && !(await readCatalog(db)).races.some((r) => r.id === raceId))
      throw new GameError("INVALID_RACE", "Raça inexistente.");
    return readRanking(db, userId, raceId);
  });
}
