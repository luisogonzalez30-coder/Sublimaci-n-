import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { AI_MAX_WORDS, buildSystemPrompt, clampWords } from "@/lib/ai/prompt";
import { COUNTRIES } from "@/lib/countries";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { currencyDecimals, formatMoney } from "@/lib/money/format";
import { quoteMessage, waLink } from "@/lib/whatsapp";
import { createPreference, getMpUser } from "./mercadopago";
import { evaluateSellerPayment } from "./payments";

describe("pago del abono (webhook mp-seller)", () => {
  const cot = { id: "c1", estado: "enviada", abono_requerido: 4000 };
  const pay = { status: "approved", external_reference: "c1", transaction_amount: 4000, currency_id: "CLP" };

  it("pago aprobado, mismo monto y moneda ⇒ abona", () => {
    expect(evaluateSellerPayment(pay, cot, "CLP")).toEqual({ action: "abonar" });
  });
  it("ignora: pendiente/rechazado, otra referencia, monto menor, otra moneda", () => {
    expect(evaluateSellerPayment({ ...pay, status: "pending" }, cot, "CLP").action).toBe("ignorar");
    expect(evaluateSellerPayment({ ...pay, status: "rejected" }, cot, "CLP").action).toBe("ignorar");
    expect(evaluateSellerPayment({ ...pay, external_reference: "otra" }, cot, "CLP").action).toBe("ignorar");
    expect(evaluateSellerPayment({ ...pay, transaction_amount: 3999 }, cot, "CLP").action).toBe("ignorar");
    expect(evaluateSellerPayment({ ...pay, currency_id: "USD" }, cot, "CLP").action).toBe("ignorar");
  });
  it("idempotente: ya abonada o cancelada no se vuelve a procesar", () => {
    expect(evaluateSellerPayment(pay, { ...cot, estado: "abonada" }, "CLP")).toEqual({ action: "ignorar", reason: "ya abonada" });
    expect(evaluateSellerPayment(pay, { ...cot, estado: "cancelada" }, "CLP").action).toBe("ignorar");
  });
});

describe("cliente Mercado Pago", () => {
  const ok = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

  it("valida el token del taller con GET /users/me", async () => {
    const f = ok({ id: 1, nickname: "TALLER", site_id: "MLC" });
    const me = await getMpUser("TOKEN-TALLER", f);
    expect(me.site_id).toBe("MLC");
    const [url, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!;
    expect(url).toBe("https://api.mercadopago.com/users/me");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer TOKEN-TALLER");
  });

  it("la preferencia usa el token del taller, external_reference = cotización y SIN comisión", async () => {
    const f = ok({ id: "pref", init_point: "https://mp/pay" });
    await createPreference("TOKEN-TALLER", { title: "Abono", amount: 4000, currency_id: "CLP", external_reference: "cot-1", notification_url: "https://app/hook", back_url: "https://app/c/x" }, f);
    const [url, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!;
    expect(url).toBe("https://api.mercadopago.com/checkout/preferences");
    const body = JSON.parse(init.body as string);
    expect(body.external_reference).toBe("cot-1");
    expect(body.items[0]).toMatchObject({ unit_price: 4000, currency_id: "CLP", quantity: 1 });
    expect(JSON.stringify(body)).not.toMatch(/marketplace_fee|application_fee|collector|sponsor/);
  });

  it("errores de MP no filtran el token", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 401 })) as unknown as typeof fetch;
    await expect(getMpUser("TOKEN-SECRETO-123", f)).rejects.toThrow(/401/);
    await getMpUser("TOKEN-SECRETO-123", f).catch((e: Error) => expect(e.message).not.toContain("TOKEN-SECRETO-123"));
  });
});

describe("cifrado de credenciales del taller", () => {
  const key = randomBytes(32);
  it("ida y vuelta, con IV aleatorio", () => {
    const a = encryptSecret("APP_USR-123", key);
    const b = encryptSecret("APP_USR-123", key);
    expect(a).not.toBe(b);
    expect(a).not.toContain("APP_USR");
    expect(decryptSecret(a, key)).toBe("APP_USR-123");
  });
  it("detecta manipulación y clave incorrecta", () => {
    const enc = encryptSecret("secreto", key);
    expect(() => decryptSecret(enc.slice(0, -4) + "AAAA", key)).toThrow();
    expect(() => decryptSecret(enc, randomBytes(32))).toThrow();
  });
});

describe("asistente IA", () => {
  const ctx = { nombre_taller: "Taller X", country_code: "MX", currency_code: "MXN", tax_rate_pct: 16, insumos: [{ nombre: "Tazón", unidad_medida: "unidad", costo_unitario: "$35.00" }], productos: [{ nombre: "Taza", precio: "$120.00", margen_pct: 45, merma_pct: 10 }] };
  it("inyecta país, moneda, impuesto, insumos y productos reales; limita a 180 palabras", () => {
    const p = buildSystemPrompt(ctx);
    expect(p).toContain("MX");
    expect(p).toContain("MXN");
    expect(p).toContain("16%");
    expect(p).toContain("Tazón: $35.00 por unidad");
    expect(p).toContain("Taza: precio $120.00");
    expect(p).toContain(`${AI_MAX_WORDS} palabras`);
  });
  it("tope duro de palabras", () => {
    const long = Array.from({ length: 400 }, (_, i) => `w${i}`).join(" ");
    expect(clampWords(long).split(/\s+/).length).toBeLessThanOrEqual(AI_MAX_WORDS);
    expect(clampWords("hola mundo")).toBe("hola mundo");
  });
});

describe("países, moneda y WhatsApp", () => {
  it("los 5 países tienen costos referenciales para el onboarding", () => {
    expect(COUNTRIES.map((c) => `${c.code}:${c.currency}`)).toEqual(["CL:CLP", "MX:MXN", "CO:COP", "AR:ARS", "PE:PEN"]);
    for (const c of COUNTRIES) {
      expect(c.seedCosts.tazon).toBeGreaterThan(0);
      expect(c.seedCosts.dtfCm).toBeGreaterThan(0);
      expect(c.seedCosts.caja).toBeGreaterThan(0);
    }
  });
  it("decimales y formato por moneda del workspace", () => {
    expect(currencyDecimals("CLP")).toBe(0);
    expect(currencyDecimals("COP")).toBe(0);
    expect(currencyDecimals("MXN")).toBe(2);
    expect(formatMoney(9990, { currency_code: "CLP", country_code: "CL" })).toMatch(/9\.990/);
  });
  it("link wa.me con texto codificado y solo dígitos", () => {
    const link = waLink("+56 9 1234-5678", "Hola 👋 total $1.000");
    expect(link.startsWith("https://wa.me/56912345678?text=")).toBe(true);
    expect(decodeURIComponent(link.split("text=")[1]!)).toBe("Hola 👋 total $1.000");
  });
  it("mensaje de cotización incluye link público y abono", () => {
    const m = quoteMessage({ cliente: "Ana", taller: "Taller X", total: "$8.000", abono: "$4.000", abonoPct: 50, link: "https://app/c/abc" });
    expect(m).toContain("https://app/c/abc");
    expect(m).toContain("50%");
  });
});
