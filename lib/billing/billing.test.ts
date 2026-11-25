import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PAYWALL_PATH, accessRedirect, hasActiveAccess, isOperationalPath } from "./access";
import { verifyMpSignature } from "./mp-signature";
import { buildPreapprovalBody, planForCountry } from "./plans";

const now = new Date("2026-06-10T12:00:00Z");
const ws = (trial: string, status = "trialing") => ({ trial_ends_at: trial, subscription_status: status });

describe("guard de trial → /suscripcion", () => {
  it("trial vigente: acceso", () => {
    expect(hasActiveAccess(ws("2026-06-12T00:00:00Z"), now)).toBe(true);
    expect(accessRedirect("/insumos", ws("2026-06-12T00:00:00Z"), now)).toBeNull();
  });

  it("trial vencido y sin plan activo ⇒ redirige TODAS las rutas operativas", () => {
    const vencido = ws("2026-06-10T11:59:59Z");
    for (const p of ["/", "/dashboard", "/insumos", "/insumos/abc", "/productos", "/productos/nuevo", "/cotizar", "/asistente", "/biblioteca", "/configuracion/pagos"]) {
      expect(accessRedirect(p, vencido, now), p).toBe(PAYWALL_PATH);
    }
  });

  it("límite exacto: now >= trial_ends_at bloquea", () => {
    expect(hasActiveAccess(ws("2026-06-10T12:00:00Z"), now)).toBe(false);
  });

  it("suscripción activa nunca se bloquea, aunque el trial haya vencido", () => {
    expect(accessRedirect("/cotizar", ws("2020-01-01T00:00:00Z", "active"), now)).toBeNull();
  });

  it.each(["past_due", "cancelled", "expired"])("estado %s con trial vencido ⇒ bloquea", (s) => {
    expect(hasActiveAccess(ws("2020-01-01T00:00:00Z", s), now)).toBe(false);
  });

  it("rutas públicas y de pago no se bloquean (evita bucles de redirección)", () => {
    const vencido = ws("2020-01-01T00:00:00Z");
    for (const p of ["/suscripcion", "/login", "/registro", "/onboarding", "/c/abc123", "/api/billing/subscribe", "/api/webhooks/mp-billing"]) {
      expect(isOperationalPath(p), p).toBe(false);
      expect(accessRedirect(p, vencido, now), p).toBeNull();
    }
  });

  it("sin workspace no redirige (lo maneja el onboarding)", () => {
    expect(accessRedirect("/insumos", null, now)).toBeNull();
  });
});

describe("plan y preapproval de Mercado Pago", () => {
  it("precio fijo: 9.990 CLP en Chile, 10 USD en el resto", () => {
    expect(planForCountry("CL")).toEqual({ amount: 9990, currency_id: "CLP" });
    for (const c of ["MX", "CO", "AR", "PE"]) expect(planForCountry(c)).toEqual({ amount: 10, currency_id: "USD" });
  });

  it("cobro mensual inmediato: SIN free_trial, external_reference = workspace.id", () => {
    const body = buildPreapprovalBody({ workspaceId: "ws-1", payerEmail: "a@b.cl", countryCode: "CL", baseUrl: "https://app.test" });
    expect(body.external_reference).toBe("ws-1");
    expect(body.auto_recurring).toMatchObject({ frequency: 1, frequency_type: "months", transaction_amount: 9990, currency_id: "CLP" });
    expect(JSON.stringify(body)).not.toContain("free_trial");
    expect(body.auto_recurring).not.toHaveProperty("free_trial");
    expect(body.status).toBe("pending");
  });
});

describe("firma de webhooks de Mercado Pago", () => {
  const secret = "s3cret";
  const sign = (id: string, req: string, ts: string) => `ts=${ts},v1=${createHmac("sha256", secret).update(`id:${id.toLowerCase()};request-id:${req};ts:${ts};`).digest("hex")}`;

  it("acepta firma válida", () => {
    expect(verifyMpSignature({ xSignature: sign("ABC123", "req-1", "1700000000"), xRequestId: "req-1", dataId: "ABC123", secret })).toBe(true);
  });
  it("rechaza firma alterada, secreto distinto o cabecera ausente", () => {
    const good = sign("123", "req-1", "1700000000");
    expect(verifyMpSignature({ xSignature: good, xRequestId: "req-2", dataId: "123", secret })).toBe(false);
    expect(verifyMpSignature({ xSignature: good, xRequestId: "req-1", dataId: "124", secret })).toBe(false);
    expect(verifyMpSignature({ xSignature: good, xRequestId: "req-1", dataId: "123", secret: "otro" })).toBe(false);
    expect(verifyMpSignature({ xSignature: null, xRequestId: "req-1", dataId: "123", secret })).toBe(false);
    expect(verifyMpSignature({ xSignature: "basura", xRequestId: "req-1", dataId: "123", secret })).toBe(false);
  });
});
