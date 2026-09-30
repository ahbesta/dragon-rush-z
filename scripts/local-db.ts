import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { mkdir } from "node:fs/promises";
await mkdir(".local", { recursive: true });
const db = await PGlite.create(".local/postgres");
const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 54329, maxConnections: 8 });
await server.start();
console.log(
  "PostgreSQL de desenvolvimento disponível em 127.0.0.1:54329. Dados persistidos em .local/postgres.",
);
const stop = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
