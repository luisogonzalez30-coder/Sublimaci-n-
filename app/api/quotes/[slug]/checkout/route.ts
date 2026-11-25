import { NextResponse } from "next/server";
import { decryptSecret } from "@/lib/crypto";
import { createPreference } from "@/lib/services/mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBaseUrl } from "@/lib/url";

interface Row {
  id: string;
  estado: string;
  abono_requerido: number;
  abono_porcentaje: number;
  slug_publico: string;
  workspace_id: string;
  workspaces: { currency_code: string; nombre_taller: string; mp_seller_access_token: string | null };
}

/** Crea la preferencia de Checkout Pro con el token DEL TALLER (cobro directo; sin comisión ni intermediación). */
export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[0-9a-f]{32}$/.test(slug)) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const admin = createAdminClient();
  const { data: cot } = await admin
    .from("cotizaciones")
    .select("id, estado, abono_requerido, abono_porcentaje, slug_publico, workspace_id, workspaces(currency_code, nombre_taller, mp_seller_access_token)")
    .eq("slug_publico", slug)
    .maybeSingle<Row>();
  if (!cot) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  if (cot.estado === "abonada") return NextResponse.json({ error: "Esta cotización ya fue abonada" }, { status: 409 });
  if (cot.estado !== "enviada") return NextResponse.json({ error: "Cotización no disponible" }, { status: 409 });
  if (!cot.workspaces.mp_seller_access_token) return NextResponse.json({ error: "El taller aún no recibe pagos online" }, { status: 409 });

  try {
    const base = await getBaseUrl();
    const pref = await createPreference(decryptSecret(cot.workspaces.mp_seller_access_token), {
      title: `Abono ${cot.abono_porcentaje}% · ${cot.workspaces.nombre_taller}`,
      amount: Number(cot.abono_requerido),
      currency_id: cot.workspaces.currency_code,
      external_reference: cot.id,
      notification_url: `${base}/api/webhooks/mp-seller?ws=${cot.workspace_id}`,
      back_url: `${base}/c/${cot.slug_publico}?pago=retorno`,
    });
    return NextResponse.json({ init_point: pref.init_point });
  } catch {
    return NextResponse.json({ error: "No se pudo iniciar el pago. Confirma por WhatsApp." }, { status: 502 });
  }
}
