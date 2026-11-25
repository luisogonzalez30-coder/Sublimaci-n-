import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { USER_A, asRole, asUser, createTestDb, createWorkspace, num } from "./test-db";

let db: PGlite;
let ws = "";
beforeAll(async () => { db = await createTestDb(); ws = await createWorkspace(db, USER_A); }, 60_000);
afterAll(async () => { await db.close(); });

const evento = (key: string, status: string, preapproval = "PRE-1", workspace = ws) =>
  db.query<{ r: string }>(`select procesar_evento_billing($1,$2,$3::uuid,$4,'subscription_preapproval','{}'::jsonb) r`, [key, preapproval, workspace, status]);
const estado = async () => (await db.query<{ s: string }>(`select subscription_status s from workspaces where id=$1`, [ws])).rows[0]!.s;

describe("webhook de suscripción MP — idempotencia", () => {
  it("el mismo evento se aplica una sola vez", async () => {
    await asRole(db, "service_role", async () => {
      expect((await evento("req-1", "authorized")).rows[0]!.r).toBe("aplicado");
      expect(await estado()).toBe("active");
      expect((await evento("req-1", "authorized")).rows[0]!.r).toBe("duplicado");
      expect((await evento("req-1", "authorized")).rows[0]!.r).toBe("duplicado");
      expect(await num(db, `select count(*) v from billing_webhook_events where event_key='req-1'`)).toBe(1);
    });
  });

  it("un duplicado tardío no revierte un estado posterior", async () => {
    await asRole(db, "service_role", async () => {
      expect((await evento("req-2", "cancelled")).rows[0]!.r).toBe("aplicado");
      expect(await estado()).toBe("cancelled");
      await evento("req-1", "authorized"); // reintento viejo de MP
      expect(await estado()).toBe("cancelled");
    });
  });

  it("mapea estados MP y guarda mp_preapproval_id; pending no cambia nada", async () => {
    await asRole(db, "service_role", async () => {
      await evento("req-3", "paused");
      expect(await estado()).toBe("past_due");
      await evento("req-4", "pending");
      expect(await estado()).toBe("past_due");
      await evento("req-5", "authorized");
      expect(await estado()).toBe("active");
      expect((await db.query<{ p: string }>(`select mp_preapproval_id p from workspaces where id=$1`, [ws])).rows[0]!.p).toBe("PRE-1");
    });
  });

  it("workspace inexistente queda registrado sin romper", async () => {
    await asRole(db, "service_role", async () => {
      expect((await evento("req-6", "authorized", "PRE-X", "00000000-0000-0000-0000-0000000000ff")).rows[0]!.r).toBe("workspace_no_encontrado");
    });
  });

  it("clientes (authenticated/anon) no pueden invocarla ni leer los eventos", async () => {
    await asUser(db, USER_A, async () => {
      await expect(evento("hack", "authorized")).rejects.toThrow(/permission denied/);
      await expect(db.query(`select * from billing_webhook_events`)).rejects.toThrow(/permission denied/);
      await expect(db.query(`update workspaces set subscription_status='active'`)).rejects.toThrow(/permission denied/);
    });
    await asRole(db, "anon", async () => {
      await expect(evento("hack2", "authorized")).rejects.toThrow(/permission denied/);
    });
  });
});
