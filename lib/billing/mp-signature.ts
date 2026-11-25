import { createHmac, timingSafeEqual } from "node:crypto";

/** Valida `x-signature` de webhooks de Mercado Pago (manifest id;request-id;ts → HMAC-SHA256). */
export function verifyMpSignature(p: { xSignature: string | null; xRequestId: string | null; dataId: string | null; secret: string }): boolean {
  if (!p.xSignature) return false;
  const parts = Object.fromEntries(p.xSignature.split(",").map((kv) => kv.trim().split("=") as [string, string]));
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;
  let manifest = "";
  if (p.dataId) manifest += `id:${p.dataId.toLowerCase()};`;
  if (p.xRequestId) manifest += `request-id:${p.xRequestId};`;
  manifest += `ts:${ts};`;
  const expected = createHmac("sha256", p.secret).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
