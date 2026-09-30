import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
let contents = await readFile(".env.local", "utf8").catch(() => "");
if (/^DATABASE_URL=.+/m.test(contents) && !/^DATABASE_URL=.*USER:PASSWORD/m.test(contents)) {
  console.log("DATABASE_URL existente preservada.");
} else {
  contents = contents
    .replace(/^DATABASE_URL=.*\r?\n?/m, "")
    .replace(/^DIRECT_DATABASE_URL=.*\r?\n?/m, "");
  contents +=
    "\nDATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/postgres\nDIRECT_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/postgres\n";
}
if (
  !/^BETTER_AUTH_SECRET=.{32,}$/m.test(contents) ||
  contents.includes("SUBSTITUA_POR_UM_SEGREDO")
) {
  contents =
    contents.replace(/^BETTER_AUTH_SECRET=.*\r?\n?/m, "") +
    `\nBETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}\n`;
}
if (!/^BETTER_AUTH_URL=.+/m.test(contents)) contents += "\nBETTER_AUTH_URL=http://localhost:3000\n";
await writeFile(".env.local", contents);
console.log("Ambiente local configurado; segredos não foram exibidos.");
