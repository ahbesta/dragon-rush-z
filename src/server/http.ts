import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getAuth } from "./auth";
import { getDatabase, type Db } from "./db/client";
import { GameError } from "./errors";

type Context = { userId: string; db: Db; body: unknown };
export async function gameRequest(
  request: Request,
  mutate: boolean,
  handler: (context: Context) => Promise<unknown>,
) {
  try {
    if (mutate) {
      const allowed = process.env.BETTER_AUTH_URL
        ? new URL(process.env.BETTER_AUTH_URL).origin
        : "";
      if (!allowed || request.headers.get("origin") !== allowed)
        throw new GameError("ORIGIN", "Origem da requisição inválida.", 403);
      if (!request.headers.get("content-type")?.includes("application/json"))
        throw new GameError("CONTENT_TYPE", "Envie JSON.", 415);
    }
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session) throw new GameError("UNAUTHORIZED", "Faça login para continuar.", 401);
    let body: unknown = null;
    if (mutate) {
      const text = await request.text();
      if (text.length > 8192)
        throw new GameError("BODY_TOO_LARGE", "Requisição muito grande.", 413);
      try {
        body = JSON.parse(text);
      } catch {
        throw new GameError("INVALID_JSON", "JSON inválido.");
      }
    }
    const result = await handler({ userId: session.user.id, db: getDatabase().db, body });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    if (error instanceof GameError)
      return NextResponse.json(
        { error: { code: error.code, message: error.message, availableAt: error.availableAt } },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    if (error instanceof ZodError)
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: "Dados inválidos. Verifique os campos enviados.",
            fields: error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
          },
        },
        { status: 400 },
      );
    console.error(
      "Falha na operação do jogo:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      {
        error: {
          code: "SERVER_ERROR",
          message: "Não foi possível concluir a ação. Tente novamente.",
        },
      },
      { status: 500 },
    );
  }
}
