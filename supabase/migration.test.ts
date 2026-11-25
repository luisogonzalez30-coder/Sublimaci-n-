import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { calculatePricing } from "../lib/pricing/calculator";
import { USER_A, USER_B, asUser as asUserH, createTestDb, num as numH } from "./test-db";

let db: PGlite;
const asUser = <T,>(uid: string, fn: () => Promise<T>) => asUserH(db, uid, fn);
const num = (sql: string, params: unknown[] = []) => numH(db, sql, params);

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe("001_core_schema — recálculo automático de precio_sugerido", () => {
  let wsA = "";
  let tazon = "";
  let caja = "";
  let prod1 = "";
  let prod2 = "";

  it("crea workspace con defaults de trial y país", async () => {
    await asUser(USER_A, async () => {
      const r = await db.query<{ id: string; currency_code: string; tax_rate_pct: string; status: string; days: number }>(
        `insert into workspaces (owner_id, nombre_taller, whatsapp) values ($1, 'Taller A', '+56911111111')
         returning id, currency_code, tax_rate_pct, subscription_status as status,
                   round(extract(epoch from (trial_ends_at - now())) / 86400)::int as days`,
        [USER_A],
      );
      wsA = r.rows[0]!.id;
      expect(r.rows[0]!.currency_code).toBe("CLP");
      expect(Number(r.rows[0]!.tax_rate_pct)).toBe(19);
      expect(r.rows[0]!.status).toBe("trialing");
      expect(r.rows[0]!.days).toBe(5);
    });
  });

  it("al cambiar costo_unitario de un insumo se actualizan TODOS los productos que lo usan", async () => {
    await asUser(USER_A, async () => {
      tazon = (await db.query<{ id: string }>(
        `insert into insumos (workspace_id, nombre, categoria, costo_unitario) values ($1,'Tazón 11oz','blanco',1000) returning id`,
        [wsA])).rows[0]!.id;
      caja = (await db.query<{ id: string }>(
        `insert into insumos (workspace_id, nombre, categoria, costo_unitario) values ($1,'Caja','empaque',500) returning id`,
        [wsA])).rows[0]!.id;

      prod1 = (await db.query<{ id: string }>(
        `insert into productos (workspace_id, nombre, merma_pct, mano_obra_fija, gastos_fijos_prorrateo, margen_objetivo_pct, aplica_iva)
         values ($1,'Tazón sublimado',10,1000,250,50,false) returning id`, [wsA])).rows[0]!.id;
      prod2 = (await db.query<{ id: string }>(
        `insert into productos (workspace_id, nombre, merma_pct, mano_obra_fija, gastos_fijos_prorrateo, margen_objetivo_pct, aplica_iva)
         values ($1,'Pack tazón + caja',0,0,0,50,true) returning id`, [wsA])).rows[0]!.id;

      await db.query(`insert into producto_insumos (producto_id, insumo_id, cantidad_requerida) values ($1,$2,2),($1,$3,1)`, [prod1, tazon, caja]);
      await db.query(`insert into producto_insumos (producto_id, insumo_id, cantidad_requerida) values ($1,$2,1),($1,$3,1)`, [prod2, tazon, caja]);

      // prod1: (2*1000+500)*1.1 + 1000 + 250 = 4000 → /0.5 = 8000
      expect(await num(`select precio_sugerido v from productos where id=$1`, [prod1])).toBe(8000);
      // prod2: (1000+500) / 0.5 = 3000 * 1.19 = 3570
      expect(await num(`select precio_sugerido v from productos where id=$1`, [prod2])).toBe(3570);

      await db.query(`update insumos set costo_unitario = 2000 where id = $1`, [tazon]);

      // prod1: (2*2000+500)*1.1 + 1250 = 4950+1250 = 6200 → 12400
      expect(await num(`select precio_sugerido v from productos where id=$1`, [prod1])).toBe(12400);
      // prod2: (2000+500)/0.5 = 5000 * 1.19 = 5950
      expect(await num(`select precio_sugerido v from productos where id=$1`, [prod2])).toBe(5950);
    });
  });

  it("SQL y calculator.ts producen el mismo precio", async () => {
    await asUser(USER_A, async () => {
      const sql = await num(`select precio_sugerido v from productos where id=$1`, [prod1]);
      const ts = calculatePricing({
        items: [
          { cantidad_requerida: 2, costo_unitario: 2000 },
          { cantidad_requerida: 1, costo_unitario: 500 },
        ],
        merma_pct: 10, mano_obra_fija: 1000, gastos_fijos_prorrateo: 250,
        margen_objetivo_pct: 50, aplica_iva: false, tax_rate_pct: 19,
      });
      expect(sql).toBe(ts.precio_final);
    });
  });

  it("recalcula al cambiar la receta, los parámetros del producto y el impuesto del workspace", async () => {
    await asUser(USER_A, async () => {
      await db.query(`update producto_insumos set cantidad_requerida = 3 where producto_id=$1 and insumo_id=$2`, [prod1, tazon]);
      // (3*2000+500)*1.1 + 1250 = 7150+1250 = 8400 → 16800
      expect(await num(`select precio_sugerido v from productos where id=$1`, [prod1])).toBe(16800);

      await db.query(`update productos set margen_objetivo_pct = 20 where id=$1`, [prod1]);
      expect(await num(`select precio_sugerido v from productos where id=$1`, [prod1])).toBe(10500); // 8400/0.8

      await db.query(`update workspaces set tax_rate_pct = 16 where id=$1`, [wsA]);
      expect(await num(`select precio_sugerido v from productos where id=$1`, [prod2])).toBe(5800); // 5000*1.16

      await db.query(`delete from producto_insumos where producto_id=$1 and insumo_id=$2`, [prod2, caja]);
      expect(await num(`select precio_sugerido v from productos where id=$1`, [prod2])).toBe(4640); // 2000/0.5*1.16
    });
  });

  it("no permite borrar un insumo en uso (on delete restrict)", async () => {
    await asUser(USER_A, async () => {
      await expect(db.query(`delete from insumos where id=$1`, [tazon])).rejects.toThrow();
    });
  });

  it("rechaza margen >= 100 y cantidades <= 0", async () => {
    await asUser(USER_A, async () => {
      await expect(db.query(`update productos set margen_objetivo_pct = 100 where id=$1`, [prod1])).rejects.toThrow();
      await expect(
        db.query(`insert into producto_insumos (producto_id, insumo_id, cantidad_requerida) values ($1,$2,0)`, [prod1, caja]),
      ).rejects.toThrow();
    });
  });
});

describe("001_core_schema — RLS y privilegios", () => {
  let wsB = "";

  it("aislamiento entre workspaces", async () => {
    await asUser(USER_B, async () => {
      wsB = (await db.query<{ id: string }>(
        `insert into workspaces (owner_id, nombre_taller, whatsapp) values ($1,'Taller B','+5491100000000') returning id`,
        [USER_B])).rows[0]!.id;
      expect((await db.query(`select 1 from workspaces`)).rows).toHaveLength(1);
      expect((await db.query(`select 1 from insumos`)).rows).toHaveLength(0);
      expect((await db.query(`select 1 from productos`)).rows).toHaveLength(0);
      expect((await db.query(`select 1 from producto_insumos`)).rows).toHaveLength(0);
    });
  });

  it("B no puede escribir en el workspace de A ni leer/borrar sus filas", async () => {
    const wsA = (await db.query<{ id: string }>(`select id from workspaces where owner_id=$1`, [USER_A])).rows[0]!.id;
    await asUser(USER_B, async () => {
      await expect(
        db.query(`insert into insumos (workspace_id, nombre) values ($1,'intruso')`, [wsA]),
      ).rejects.toThrow(/row-level security/);
      expect((await db.query(`delete from insumos where workspace_id=$1 returning id`, [wsA])).rows).toHaveLength(0);
      expect((await db.query(`update productos set nombre='x' where workspace_id=$1 returning id`, [wsA])).rows).toHaveLength(0);
    });
  });

  it("no se puede mezclar insumos de otro workspace en una receta propia", async () => {
    const foreignInsumo = (await db.query<{ id: string }>(`select id from insumos limit 1`)).rows[0]!.id;
    await asUser(USER_B, async () => {
      const p = (await db.query<{ id: string }>(
        `insert into productos (workspace_id, nombre) values ($1,'mío') returning id`, [wsB])).rows[0]!.id;
      await expect(
        db.query(`insert into producto_insumos (producto_id, insumo_id, cantidad_requerida) values ($1,$2,1)`, [p, foreignInsumo]),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it("no se puede crear un workspace a nombre de otro usuario", async () => {
    await asUser(USER_B, async () => {
      await expect(
        db.query(`insert into workspaces (owner_id, nombre_taller, whatsapp) values ($1,'x','1')`, [USER_A]),
      ).rejects.toThrow();
    });
  });

  it("el cliente no puede tocar trial, suscripción ni el token de Mercado Pago", async () => {
    await asUser(USER_B, async () => {
      await expect(db.query(`update workspaces set trial_ends_at = now() + interval '10 years'`)).rejects.toThrow(/permission denied/);
      await expect(db.query(`update workspaces set subscription_status = 'active'`)).rejects.toThrow(/permission denied/);
      await expect(db.query(`update workspaces set mp_seller_access_token = 'x'`)).rejects.toThrow(/permission denied/);
      await expect(db.query(`select mp_seller_access_token from workspaces`)).rejects.toThrow(/permission denied/);
    });
  });

  it("anon no accede a nada", async () => {
    await db.exec(`set role anon;`);
    try {
      await expect(db.query(`select 1 from insumos`)).rejects.toThrow(/permission denied/);
      await expect(db.query(`select 1 from workspaces`)).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec(`reset role;`);
    }
  });
});
