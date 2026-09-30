import { gameRequest } from "@/server/http";
import { createCharacter, readSnapshot } from "@/server/game-service";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return gameRequest(request, true, async ({ db, userId, body }) => ({
    ...(await createCharacter(db, userId, body)),
    snapshot: await readSnapshot(db, userId),
  }));
}
