import { gameRequest } from "@/server/http";
import { executeAction, readSnapshot } from "@/server/game-service";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return gameRequest(request, true, async ({ db, userId, body }) => ({
    ...(await executeAction(db, userId, body)),
    snapshot: await readSnapshot(db, userId),
  }));
}
