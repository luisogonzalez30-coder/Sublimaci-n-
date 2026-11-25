import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { USER_A, USER_B, asRole, asUser, createTestDb, createWorkspace, num } from "./test-db";

let db: PGlite;
let wsA = "";
let slug = "";

beforeAll(async () => {
  db = await createTestDb();
  wsA = await createWorkspace(db, USER_A, { country: "MX", currency: "MXN", tax: 16 });
  await createWorkspace(db, USER_B);
  // El token del taller solo lo escribe el servidor (service_role).
  await asRole(db, "service_role", () => db.query(`update workspaces set mp_seller_access_token='SECRET-TOKEN' where id=$1`, [wsA]));
}, 60_000);
afterAll(async () => { await db.close(); });

describe("cotizaciones: RLS, privilegios y vista pública", () => {
  it("crea cotización y la BD genera un slug no adivinable", async () => {
    await asUser(db, USER_A, async () => {
      const r = await db.query<{ slug_publico: string }>(
        `insert into cotizaciones (workspace_id, cliente_nombre, cliente_whatsapp, items, total, abono_porcentaje, abono_requerido, notas_personalizacion)
         values ($1,'Ana','56911112222','[{"nombre":"Tazón","cantidad":12}]'::jsonb, 1000, 50, 500, 'Nombre en dorado') returning slug_publico`, [wsA]);
      slug = r.rows[0]!.slug_publico;
      expect(slug).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  it("el cliente no puede fijar el slug, ni alterar total/items, ni abono > total", async () => {
    await asUser(db, USER_A, async () => {
      await expect(db.query(`insert into cotizaciones (workspace_id, cliente_nombre, total, abono_requerido, slug_publico) values ($1,'x',10,5,'abc')`, [wsA])).rejects.toThrow(/permission denied/);
      await expect(db.query(`update cotizaciones set total = 1`)).rejects.toThrow(/permission denied/);
      await expect(db.query(`update cotizaciones set items = '[]'`)).rejects.toThrow(/permission denied/);
      await expect(db.query(`insert into cotizaciones (workspace_id, cliente_nombre, total, abono_requerido) values ($1,'x',10,50)`, [wsA])).rejects.toThrow();
    });
  });

  it("aislamiento: otro workspace no ve ni escribe", async () => {
    await asUser(db, USER_B, async () => {
      expect(await num(db, `select count(*) v from cotizaciones`)).toBe(0);
      await expect(db.query(`insert into cotizaciones (workspace_id, cliente_nombre, total, abono_requerido) values ($1,'x',10,5)`, [wsA])).rejects.toThrow(/row-level security/);
    });
  });

  it("anon no lee la tabla, pero sí la vista pública por slug exacto — sin datos privados", async () => {
    await asRole(db, "anon", async () => {
      await expect(db.query(`select * from cotizaciones`)).rejects.toThrow(/permission denied/);
      const r = await db.query<{ c: Record<string, unknown> | null }>(`select cotizacion_publica($1) c`, [slug]);
      const c = r.rows[0]!.c!;
      expect(c.cliente_nombre).toBe("Ana");
      expect(c.abono_requerido).toBe(500);
      expect((c.taller as Record<string, unknown>).mp_conectado).toBe(true);
      const json = JSON.stringify(c);
      expect(json).not.toContain("SECRET-TOKEN");
      expect(json).not.toContain("56911112222"); // whatsapp del cliente
      expect(json).not.toContain(wsA);
      expect(json).not.toContain("mp_seller_access_token");
      // slug parcial / distinto ⇒ nada
      expect((await db.query<{ c: unknown }>(`select cotizacion_publica($1) c`, [slug.slice(0, 31)])).rows[0]!.c).toBeNull();
      expect((await db.query<{ c: unknown }>(`select cotizacion_publica($1) c`, ["' or 1=1 --"])).rows[0]!.c).toBeNull();
    });
  });

  it("el cliente no puede leer el token pero sí el flag mp_conectado", async () => {
    await asUser(db, USER_A, async () => {
      await expect(db.query(`select mp_seller_access_token from workspaces`)).rejects.toThrow(/permission denied/);
      expect((await db.query<{ mp_conectado: boolean }>(`select mp_conectado from workspaces`)).rows[0]!.mp_conectado).toBe(true);
    });
  });
});

describe("cuota diaria del asistente IA (20 mensajes)", () => {
  it("permite 20 y bloquea el 21; otro workspace no se ve afectado", async () => {
    await asUser(db, USER_A, async () => {
      const remaining: number[] = [];
      for (let i = 0; i < 20; i++) remaining.push((await db.query<{ r: number }>(`select consumir_mensaje_ia() r`)).rows[0]!.r);
      expect(remaining[0]).toBe(19);
      expect(remaining[19]).toBe(0);
      expect((await db.query<{ r: number }>(`select consumir_mensaje_ia() r`)).rows[0]!.r).toBe(-1);
      expect(await num(db, `select mensajes v from ai_uso_diario`)).toBe(20);
    });
    await asUser(db, USER_B, async () => {
      expect((await db.query<{ r: number }>(`select consumir_mensaje_ia() r`)).rows[0]!.r).toBe(19);
    });
  });

  it("el cliente no puede resetear su contador", async () => {
    await asUser(db, USER_A, async () => {
      await expect(db.query(`update ai_uso_diario set mensajes = 0`)).rejects.toThrow(/permission denied/);
      await expect(db.query(`delete from ai_uso_diario`)).rejects.toThrow(/permission denied/);
    });
  });
});
