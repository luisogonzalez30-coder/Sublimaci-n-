import { NextResponse, type NextRequest } from "next/server";
import { decryptSecret } from "@/lib/crypto";
import { evaluateSellerPayment } from "@/lib/services/payments";
import { getPayment } from "@/lib/services/mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Webhook de pagos de cada taller. La autenticidad se verifica CONSULTANDO el pago a la API de MP
 * con el token del taller (no se confía en el cuerpo). Idempotente: solo pasa 'enviada' → 'abonada'.
 */
export async function POST(req: NextRequest) {
  const ws = req.nextUrl.searchParams.get("ws");
  if (!ws || !UUID.test(ws)) return NextResponse.json({ ok: false }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { type?: string; topic?: string; data?: { id?: string | number } };
  const type = body.type ?? body.topic ?? req.nextUrl.searchParams.get("type") ?? req.nextUrl.searchParams.get("topic");
  const paymentId = String(body.data?.id ?? req.nextUrl.searchParams.get("data.id") ?? req.nextUrl.searchParams.get("id") ?? "");
  if (type !== "payment" || !paymentId) return NextResponse.json({ ok: true, ignored: true });

  const admin = createAdminClient();
  const { data: workspace } = await admin.from("workspaces").select("id, currency_code, mp_seller_access_token").eq("id", ws).maybeSingle<{ id: string; currency_code: string; mp_seller_access_token: string | null }>();
  if (!workspace?.mp_seller_access_token) return NextResponse.json({ ok: true, ignored: true });

  let payment;
  try {
    payment = await getPayment(decryptSecret(workspace.mp_seller_access_token), paymentId);
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 }); // MP reintenta
  }
  if (!payment.external_reference || !UUID.test(payment.external_reference)) return NextResponse.json({ ok: true, ignored: true });

  const { data: cot } = await admin
    .from("cotizaciones")
    .select("id, estado, abono_requerido")
    .eq("id", payment.external_reference)
    .eq("workspace_id", workspace.id)
    .maybeSingle<{ id: string; estado: string; abono_requerido: number }>();
  if (!cot) return NextResponse.json({ ok: true, ignored: true });

  const decision = evaluateSellerPayment(payment, { ...cot, abono_requerido: Number(cot.abono_requerido) }, workspace.currency_code);
  if (decision.action === "ignorar") return NextResponse.json({ ok: true, ignored: true, reason: decision.reason });

  const { error } = await admin.from("cotizaciones").update({ estado: "abonada" }).eq("id", cot.id).eq("estado", "enviada");
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true, abonada: true });
}
