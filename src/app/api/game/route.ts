import { gameRequest } from "@/server/http";
import { readSnapshot } from "@/server/game-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return gameRequest(request, false, async ({ db, userId }) => ({
    snapshot: await readSnapshot(db, userId),
  }));
}
