import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

export const USER_A = "00000000-0000-0000-0000-00000000000a";
export const USER_B = "00000000-0000-0000-0000-00000000000b";

/** Postgres en memoria con stubs de Supabase (roles, auth.uid) y TODAS las migraciones en orden. */
export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    grant select on auth.users to authenticated;
    insert into auth.users values ('${USER_A}'), ('${USER_B}');
  `);
  const dir = path.join(import.meta.dirname, "migrations");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(path.join(dir, f), "utf8"));
  }
  // Supabase concede a service_role acceso total por defecto en public.
  await db.exec(`grant all on all tables in schema public to service_role; grant execute on all functions in schema public to service_role;`);
  return db;
}

/** Ejecuta `fn` con el rol `authenticated` y auth.uid() = uid (como una request PostgREST). */
export async function asUser<T>(db: PGlite, uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
  }
}

export async function asRole<T>(db: PGlite, role: "anon" | "service_role", fn: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub', '', false); set role ${role};`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
  }
}

export async function num(db: PGlite, sql: string, params: unknown[] = []): Promise<number | null> {
  const r = await db.query<{ v: string | null }>(sql, params);
  const v = r.rows[0]?.v;
  return v == null ? null : Number(v);
}

/** Crea un workspace (como el usuario) y devuelve su id. */
export async function createWorkspace(db: PGlite, uid: string, extra: { country?: string; currency?: string; tax?: number } = {}): Promise<string> {
  return asUser(db, uid, async () => {
    const r = await db.query<{ id: string }>(
      `insert into workspaces (owner_id, nombre_taller, whatsapp, country_code, currency_code, tax_rate_pct)
       values ($1, $5, '+56911111111', $2, $3, $4) returning id`,
      [uid, extra.country ?? "CL", extra.currency ?? "CLP", extra.tax ?? 19, `Taller ${uid.slice(-1)}`],
    );
    return r.rows[0]!.id;
  });
}
