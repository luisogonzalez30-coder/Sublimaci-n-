import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatMoney } from "@/lib/money/format";
import { createClient } from "@/lib/supabase/server";
import type { CotizacionPublica } from "@/lib/types";
import { waLink } from "@/lib/whatsapp";
import { PayButton } from "./pay-button";

export const metadata: Metadata = { title: "Tu cotización", robots: { index: false, follow: false } };

/** Vista pública (Server Component): solo datos aptos para el cliente final, vía RPC por slug exacto. */
export default async function CotizacionPublicaPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ pago?: string }> }) {
  const { slug } = await params;
  const { pago } = await searchParams;
  if (!/^[0-9a-f]{32}$/.test(slug)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.rpc("cotizacion_publica", { p_slug: slug });
  const c = data as CotizacionPublica | null;
  if (!c) notFound();

  const money = { currency_code: c.taller.currency_code, country_code: c.taller.country_code };
  const abonada = c.estado === "abonada";
  const pctLabel = Number(c.abono_porcentaje);
  const confirmMsg = `Hola ${c.taller.nombre_taller}, soy ${c.cliente_nombre}. Confirmo mi cotización por ${formatMoney(Number(c.total), money)} y haré el abono de ${formatMoney(Number(c.abono_requerido), money)}.`;

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-6">
      <header>
        <p className="text-sm text-slate-500">{c.taller.nombre_taller}</p>
        <h1 className="text-2xl font-bold">Cotización para {c.cliente_nombre}</h1>
      </header>

      {abonada && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">✅ Abono recibido. ¡Gracias! Tu pedido está reservado.</p>}
      {c.estado === "cancelada" && <p className="rounded-xl bg-slate-200 p-3 text-sm">Esta cotización fue cancelada.</p>}
      {!abonada && pago === "retorno" && <p role="status" className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-800">Estamos confirmando tu pago. Actualiza en unos segundos.</p>}

      <section className="card">
        <ul className="divide-y divide-slate-100">
          {c.items.map((i, idx) => (
            <li key={idx} className="flex items-start justify-between gap-3 py-2 text-sm">
              <span>{i.nombre}<span className="block text-xs text-slate-500">{i.cantidad} × {formatMoney(Number(i.precio_unitario), money)}</span></span>
              <span className="font-medium tabular-nums">{formatMoney(Number(i.subtotal), money)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm">
          <p className="flex justify-between text-base font-bold"><span>Total</span><span className="tabular-nums">{formatMoney(Number(c.total), money)}</span></p>
          <p className="flex justify-between"><span>Abono {pctLabel}%</span><span className="font-semibold tabular-nums">{formatMoney(Number(c.abono_requerido), money)}</span></p>
          <p className="flex justify-between text-slate-500"><span>Saldo a la entrega</span><span className="tabular-nums">{formatMoney(Number(c.total) - Number(c.abono_requerido), money)}</span></p>
        </div>
      </section>

      <section className="card space-y-1 text-sm">
        <p>⏱️ Plazo de entrega: <b>{c.plazo_entrega_dias} días</b> desde el abono.</p>
        {c.notas_personalizacion && <p>📝 {c.notas_personalizacion}</p>}
      </section>

      {c.estado === "enviada" && (
        <section className="space-y-3">
          {c.taller.mp_conectado ? (
            <PayButton slug={c.slug} label={`Pagar Abono del ${pctLabel}% Online`} />
          ) : null}
          <a
            className={c.taller.mp_conectado ? "btn-ghost w-full" : "btn w-full"}
            href={waLink(c.taller.whatsapp, confirmMsg)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {c.taller.mp_conectado ? "Prefiero confirmar por WhatsApp" : "Confirmar por WhatsApp"}
          </a>
        </section>
      )}
    </main>
  );
}
