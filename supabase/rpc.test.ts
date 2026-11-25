import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { USER_A, USER_B, asUser, createTestDb, createWorkspace, num } from "./test-db";

let db: PGlite;
let tazon = "";
let caja = "";

beforeAll(async () => {
  db = await createTestDb();
  await createWorkspace(db, USER_A);
  await createWorkspace(db, USER_B);
  await asUser(db, USER_A, async () => {
    const ws = (await db.query<{ id: string }>(`select id from workspaces`)).rows[0]!.id;
    tazon = (await db.query<{ id: string }>(`insert into insumos (workspace_id,nombre,costo_unitario) values ($1,'Tazón',1000) returning id`, [ws])).rows[0]!.id;
    caja = (await db.query<{ id: string }>(`insert into insumos (workspace_id,nombre,costo_unitario) values ($1,'Caja',500) returning id`, [ws])).rows[0]!.id;
  });
}, 60_000);
afterAll(async () => { await db.close(); });

const rpc = (producto: object, items: object[]) =>
  db.query<{ id: string }>(`select upsert_producto_con_insumos($1::jsonb, $2::jsonb) as id`, [JSON.stringify(producto), JSON.stringify(items)]);

describe("RPC upsert_producto_con_insumos (transaccional)", () => {
  let id = "";
  const base = { nombre: "Tazón", merma_pct: 10, mano_obra_fija: 1000, gastos_fijos_prorrateo: 250, margen_objetivo_pct: 50, aplica_iva: false };

  it("crea producto + receta y el precio queda calculado", async () => {
    await asUser(db, USER_A, async () => {
      id = (await rpc(base, [{ insumo_id: tazon, cantidad_requerida: 2 }, { insumo_id: caja, cantidad_requerida: 1 }])).rows[0]!.id;
      expect(await num(db, `select count(*) v from producto_insumos where producto_id=$1`, [id])).toBe(2);
      expect(await num(db, `select precio_sugerido v from productos where id=$1`, [id])).toBe(8000);
    });
  });

  it("actualiza parámetros y reemplaza la receta", async () => {
    await asUser(db, USER_A, async () => {
      await rpc({ ...base, id, nombre: "Tazón v2", margen_objetivo_pct: 20 }, [{ insumo_id: tazon, cantidad_requerida: 1 }]);
      expect((await db.query<{ nombre: string }>(`select nombre from productos where id=$1`, [id])).rows[0]!.nombre).toBe("Tazón v2");
      expect(await num(db, `select count(*) v from producto_insumos where producto_id=$1`, [id])).toBe(1);
      // (1000*1.1 + 1250) / 0.8 = 2937.5
      expect(await num(db, `select precio_sugerido v from productos where id=$1`, [id])).toBe(2937.5);
    });
  });

  it("falla a medias ⇒ ROLLBACK total: creación no deja producto huérfano", async () => {
    await asUser(db, USER_A, async () => {
      const before = await num(db, `select count(*) v from productos`);
      await expect(rpc({ ...base, nombre: "Huérfano" }, [{ insumo_id: tazon, cantidad_requerida: 1 }, { insumo_id: tazon, cantidad_requerida: 0 }])).rejects.toThrow();
      expect(await num(db, `select count(*) v from productos`)).toBe(before);
    });
  });

  it("falla a medias ⇒ ROLLBACK total: edición conserva la receta anterior", async () => {
    await asUser(db, USER_A, async () => {
      await expect(rpc({ ...base, id, nombre: "NO DEBE GUARDARSE" }, [{ insumo_id: tazon, cantidad_requerida: 1 }, { insumo_id: caja, cantidad_requerida: -3 }])).rejects.toThrow();
      expect((await db.query<{ nombre: string }>(`select nombre from productos where id=$1`, [id])).rows[0]!.nombre).toBe("Tazón v2");
      expect(await num(db, `select count(*) v from producto_insumos where producto_id=$1`, [id])).toBe(1);
    });
  });

  it("no permite usar insumos de otro workspace ni editar productos ajenos", async () => {
    await asUser(db, USER_B, async () => {
      await expect(rpc({ ...base, nombre: "Intruso" }, [{ insumo_id: tazon, cantidad_requerida: 1 }])).rejects.toThrow(/row-level security/);
      await expect(rpc({ ...base, id, nombre: "Hack" }, [])).rejects.toThrow(/PRODUCTO_NO_ENCONTRADO/);
      expect(await num(db, `select count(*) v from productos`)).toBe(0);
    });
  });

  it("anon no puede ejecutarla", async () => {
    await db.exec(`set role anon;`);
    try { await expect(rpc(base, [])).rejects.toThrow(/permission denied/); } finally { await db.exec(`reset role;`); }
  });
});
