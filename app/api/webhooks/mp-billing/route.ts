import { NextResponse, type NextRequest } from "next/server";
import { verifyMpSignature } from "@/lib/billing/mp-signature";
import { getPreapproval } from "@/lib/services/mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Webhook de suscripciones (plataforma). Valida firma, consulta el estado REAL en MP
 * y lo aplica con `procesar_evento_billing` (idempotente por event_key).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { type?: string; data?: { id?: string } };
  const type = body.type ?? req.nextUrl.searchParams.get("type");
  const id = body.data?.id ?? req.nextUrl.searchParams.get("data.id");
  if (!id || !type?.includes("preapproval")) return NextResponse.json({ ok: true, ignored: true });

  const secret = process.env.MP_WEBHOOK_SECRET;
  if (secret) {
    const ok = verifyMpSignature({ xSignature: req.headers.get("x-signature"), xRequestId: req.headers.get("x-request-id"), dataId: id, secret });
    if (!ok) return NextResponse.json({ ok: false }, { status: 401 });
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "MP_WEBHOOK_SECRET no configurado" }, { status: 500 });
  }

  const token = process.env.MP_PLATFORM_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ ok: false }, { status: 503 });

  let pre;
  try {
    pre = await getPreapproval(token, id);
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 }); // MP reintenta
  }
  if (!pre.external_reference || !/^[0-9a-f-]{36}$/i.test(pre.external_reference)) return NextResponse.json({ ok: true, ignored: true });

  const eventKey = req.headers.get("x-request-id") ?? `${pre.id}:${pre.status}:${pre.last_modified ?? ""}`;
  const { data, error } = await createAdminClient().rpc("procesar_evento_billing", {
    p_event_key: eventKey,
    p_preapproval_id: pre.id,
    p_workspace_id: pre.external_reference,
    p_mp_status: pre.status,
    p_tipo: type,
    p_payload: { status: pre.status, last_modified: pre.last_modified ?? null },
  });
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true, resultado: data });
}
