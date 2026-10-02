import { databaseUrl } from "./environment";
import { Client } from "pg";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const role = "dragon_rush_z_runtime";
const adminUrl = databaseUrl(true);
const currentUrl = databaseUrl();
const client = new Client({ connectionString: adminUrl, connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  const existing = await client.query("SELECT rolname FROM pg_roles WHERE rolname = $1", [role]);
  if (existing.rowCount) {
    if (new URL(currentUrl).username !== role)
      throw new Error(
        "A role já existe. Configure DATABASE_URL com as credenciais dela; nenhuma senha foi alterada.",
      );
    await client.query(
      `GRANT SELECT ON chapters, quests, settlements, shop_offers, recipes, exploration_events, exploration_routes TO ${role}`,
    );
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON exploration_sessions TO ${role}`);
    console.log("Permissões de leitura do catálogo atualizadas. Nenhuma credencial alterada.");
  } else {
    const password = randomBytes(32).toString("hex");
    await client.query("BEGIN");
    await client.query("SELECT set_config('dragon.runtime_password', $1, true)", [password]);
    await client.query(
      `DO $$ BEGIN EXECUTE format('CREATE ROLE dragon_rush_z_runtime LOGIN PASSWORD %L', current_setting('dragon.runtime_password')); END $$`,
    );
    await client.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
    await client.query(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${role}`);
    await client.query(
      `GRANT INSERT, UPDATE, DELETE ON auth_user, auth_session, auth_account, auth_verification, rate_limit, characters, inventory, character_techniques, character_transformations, activities, battles, active_battles, history, action_receipts, exploration_sessions TO ${role}`,
    );
    await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`);
    await client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${role}`,
    );
    await client.query("COMMIT");
    const runtimeUrl = new URL(currentUrl);
    runtimeUrl.username = role;
    runtimeUrl.password = password;
    runtimeUrl.searchParams.set("sslmode", "verify-full");
    let contents = await readFile(".env.local", "utf8");
    // Preserva a conexão administrativa para migrations; nunca a envia ao navegador.
    contents = contents.replace(/^DIRECT_DATABASE_URL=.*$/m, `DIRECT_DATABASE_URL=${adminUrl}`);
    if (!/^DIRECT_DATABASE_URL=/m.test(contents)) contents += `\nDIRECT_DATABASE_URL=${adminUrl}\n`;
    contents = contents.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${runtimeUrl.toString()}`);
    await writeFile(".env.local", contents);
    console.log(
      "Role restrita criada. DATABASE_URL atualizada; DIRECT_DATABASE_URL administrativa preservada. Segredos não foram exibidos.",
    );
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error(
    error instanceof Error
      ? error.message.replace(/postgres(?:ql)?:\/\/\S+/g, "[URL omitida]")
      : "Não foi possível configurar a role.",
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
