import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { USER_A, USER_B, asRole, asUser, createTestDb, createWorkspace, num } from "./test-db";

let db: PGlite;
let free = "";
let pro = "";
let wsB = "";

beforeAll(async () => {
  db = await createTestDb();
  await createWorkspace(db, USER_A, { country: "CL" });
  wsB = await createWorkspace(db, USER_B, { country: "MX", currency: "MXN", tax: 16 });
  // Plantillas de prueba sin ventana de fechas (las del seed dependen del calendario).
  const content = (n: string) => JSON.stringify({
    insumos: [{ key: "t", nombre: "Tazón blanco 11oz", categoria: "blanco", unidad_medida: "unidad", costo_base: 1500 }, { key: "c", nombre: `Caja ${n}`, categoria: "empaque", unidad_medida: "unidad", costo_base: 450 }],
    productos: [{ nombre: `Pack ${n}`, merma_pct: 10, mano_obra_base: 1000, gastos_base: 250, margen_objetivo_pct: 50, aplica_iva: false, receta: [{ insumo: "t", cantidad: 1 }, { insumo: "c", cantidad: 1 }] }],
  });
  free = (await db.query<{ id: string }>(`insert into plantillas_temporada (slug,nombre,contenido) values ('t-free','Free',$1::jsonb) returning id`, [content("free")])).rows[0]!.id;
  pro = (await db.query<{ id: string }>(`insert into plantillas_temporada (slug,nombre,solo_pro,contenido) values ('t-pro','Pro',true,$1::jsonb) returning id`, [content("pro")])).rows[0]!.id;
}, 60_000);
afterAll(async () => { await db.close(); });

const importar = (id: string) => db.query<{ r: Record<string, unknown> }>(`select importar_plantilla($1) r`, [id]);
const setStatus = (uid: string, status: string, trialEnds?: string) =>
  asRole(db, "service_role", () => db.query(
    `update workspaces set subscription_status=$2, trial_ends_at = coalesce($3::timestamptz, trial_ends_at) where owner_id=$1`, [uid, status, trialEnds ?? null]));

describe("seed", () => {
  it("incluye los 4 packs LATAM", async () => {
    const r = await db.query<{ slug: string }>(`select slug from plantillas_temporada where slug in ('dia-de-la-madre','egresos-escolares','corporativo-pyme','navidad')`);
    expect(r.rows).toHaveLength(4);
  });
  it("el seed es importable (contenido válido) con suscripción activa", async () => {
    await setStatus(USER_B, "active");
    await asUser(db, USER_B, async () => {
      // las ventanas del seed pueden estar fuera de fecha: validamos con una copia sin ventana
      await db.exec(`reset role;`);
    });
    const seeded = (await db.query<{ id: string }>(
      `insert into plantillas_temporada (slug,nombre,contenido) select 'copia-'||slug, nombre, contenido from plantillas_temporada where slug='navidad' returning id`)).rows;
    await asUser(db, USER_B, async () => {
      const r = (await importar(seeded[0]!.id)).rows[0]!.r;
      expect(r.productos_creados).toBe(2);
    });
    await setStatus(USER_B, "trialing");
  });
});

describe("límite de importaciones: trial = 1, Pro = ilimitado", () => {
  it("trial: la 1ª importación crea insumos faltantes y productos costeados", async () => {
    await asUser(db, USER_A, async () => {
      const r = (await importar(free)).rows[0]!.r;
      expect(r).toMatchObject({ insumos_creados: 2, productos_creados: 1 });
      expect(await num(db, `select biblioteca_imports_usados v from workspaces`)).toBe(1);
      // costos de CL (factor 1): (1500+450)*1.1 + 1250 = 3395 → /0.5 = 6790
      expect(await num(db, `select precio_sugerido v from productos where nombre='Pack free'`)).toBe(6790);
    });
  });

  it("trial: la 2ª importación se bloquea", async () => {
    await asUser(db, USER_A, async () => {
      await expect(importar(free)).rejects.toThrow(/BIBLIOTECA_LIMITE_TRIAL/);
      expect(await num(db, `select count(*) v from productos`)).toBe(1);
      expect(await num(db, `select biblioteca_imports_usados v from workspaces`)).toBe(1);
    });
  });

  it("trial: los packs solo_pro están bloqueados", async () => {
    await asUser(db, USER_B, async () => {
      await expect(importar(pro)).rejects.toThrow(/BIBLIOTECA_SOLO_PRO/);
    });
  });

  it("Pro (active): importaciones ilimitadas, reutiliza insumos existentes y no duplica nombres", async () => {
    await setStatus(USER_A, "active");
    await asUser(db, USER_A, async () => {
      for (let i = 0; i < 3; i++) await importar(free);
      expect(await num(db, `select biblioteca_imports_usados v from workspaces`)).toBe(4);
      expect(await num(db, `select count(*) v from insumos where lower(nombre)=lower('Tazón blanco 11oz')`)).toBe(1);
      expect(await num(db, `select count(*) v from productos`)).toBe(4);
      expect(await num(db, `select count(distinct nombre) v from productos`)).toBe(4);
      const r = (await importar(pro)).rows[0]!.r;
      expect(r.productos_creados).toBe(1);
    });
  });

  it("escala los costos al país del workspace (MX ≠ CL)", async () => {
    await setStatus(USER_B, "active");
    await asUser(db, USER_B, async () => {
      await importar(free);
      expect(await num(db, `select costo_unitario v from insumos where nombre='Tazón blanco 11oz'`)).toBe(34.95); // 1500 * 0.0233
    });
    expect(wsB).toBeTruthy();
  });

  it("trial vencido bloquea la importación aunque no haya usado ninguna", async () => {
    await asRole(db, "service_role", () => db.query(`update workspaces set subscription_status='trialing', biblioteca_imports_usados=0, trial_ends_at = now() - interval '1 day' where owner_id=$1`, [USER_B]));
    await asUser(db, USER_B, async () => {
      await expect(importar(free)).rejects.toThrow(/TRIAL_VENCIDO/);
    });
  });

  it("el cliente no puede resetear su contador de importaciones", async () => {
    await asUser(db, USER_A, async () => {
      await expect(db.query(`update workspaces set biblioteca_imports_usados = 0`)).rejects.toThrow(/permission denied/);
    });
  });

  it("plantillas inactivas o fuera de ventana no se importan", async () => {
    const fut = (await db.query<{ id: string }>(`insert into plantillas_temporada (slug,nombre,publicar_desde,contenido) values ('t-fut','Futuro', current_date + 30, '{"insumos":[],"productos":[]}') returning id`)).rows[0]!.id;
    await asUser(db, USER_A, async () => {
      await expect(importar(fut)).rejects.toThrow(/BIBLIOTECA_NO_DISPONIBLE/);
    });
  });
});
