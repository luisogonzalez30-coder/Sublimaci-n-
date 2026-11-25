// Aplica supabase/migrations/*.sql en orden contra SUPABASE_DB_URL, registrando las ya aplicadas.
// Uso: npm run db:push   (lee .env.local si existe)
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import pg from "pg";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
const url = process.env.SUPABASE_DB_URL;
if (!url || url.startsWith("PEGAR_")) {
  console.error("SUPABASE_DB_URL no está configurada: no se aplicaron migraciones.");
  process.exit(2);
}
const dir = path.resolve("supabase/migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query("create table if not exists public.app_schema_migrations (name text primary key, applied_at timestamptz not null default now())");
  await client.query("alter table public.app_schema_migrations enable row level security");
  const done = new Set((await client.query("select name from public.app_schema_migrations")).rows.map((r) => r.name));
  for (const f of files) {
    if (done.has(f)) continue;
    process.stdout.write(`aplicando ${f}… `);
    await client.query("begin");
    try {
      await client.query(readFileSync(path.join(dir, f), "utf8"));
      await client.query("insert into public.app_schema_migrations (name) values ($1)", [f]);
      await client.query("commit");
      console.log("ok");
    } catch (e) {
      await client.query("rollback");
      throw e;
    }
  }
  console.log("migraciones al día");
} finally {
  await client.end();
}
