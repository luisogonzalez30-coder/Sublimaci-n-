"use client";

import { useMemo, useState, useTransition } from "react";
import { crearCotizacion, type CotizacionCreada } from "@/app/actions/cotizaciones";
import { PHONE_PREFIXES, getCountry } from "@/lib/countries";
import { formatMoney, type MoneyContext } from "@/lib/money/format";
import { PricingError, type PricingInput } from "@/lib/pricing/calculator";
import { buildQuote, DEFAULT_ABONO_PCT } from "@/lib/pricing/quote";
import type { CotizacionResumen } from "@/lib/types";
import { digitsOnly, quoteMessage, waLink } from "@/lib/whatsapp";

interface Item { id: string; nombre: string; input: PricingInput }
interface WorkspaceLite extends MoneyContext { nombre_taller: string }

const ESTADO_STYLE: Record<string, string> = {
  enviada: "bg-amber-100 text-amber-800",
  abonada: "bg-emerald-100 text-emerald-800",
  cancelada: "bg-slate-200 text-slate-600",
  borrador: "bg-slate-100 text-slate-600",
};

export function CotizadorClient({ productos, recientes, workspace }: { productos: Item[]; recientes: CotizacionResumen[]; workspace: WorkspaceLite }) {
  const money: MoneyContext = workspace;
  const [qty, setQty] = useState<Record<string, number>>({});
  const [cliente, setCliente] = useState({ nombre: "", prefix: getCountry(workspace.country_code).prefix, telefono: "", plazo: "7", notas: "", abono: String(DEFAULT_ABONO_PCT) });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [creada, setCreada] = useState<CotizacionCreada>();
  const [copiado, setCopiado] = useState(false);

  const abonoPct = Number(cliente.abono.replace(",", ".")) || 0;
  const lineas = productos.filter((p) => (qty[p.id] ?? 0) > 0);

  const preview = useMemo(() => {
    if (lineas.length === 0) return null;
    try {
      return buildQuote(lineas.map((p) => ({ producto_id: p.id, nombre: p.nombre, cantidad: qty[p.id]!, pricing: p.input })), workspace.currency_code, abonoPct);
    } catch (e) {
      return e instanceof PricingError ? e.message : "Revisa los datos";
    }
  }, [lineas, qty, workspace.currency_code, abonoPct]);

  const whatsappFull = `${cliente.prefix}${cliente.telefono}`;
  const lineOf = (id: string) => (preview && typeof preview !== "string" ? preview.items.find((i) => i.producto_id === id) : undefined);

  if (productos.length === 0) return <p className="card text-sm text-slate-500">Crea un producto para poder cotizar.</p>;

  if (creada) {
    const msg = quoteMessage({
      cliente: cliente.nombre,
      taller: workspace.nombre_taller,
      total: formatMoney(creada.total, money),
      abono: formatMoney(creada.abono_requerido, money),
      abonoPct,
      link: creada.url,
    });
    return (
      <div className="space-y-3">
        <section className="card space-y-3">
          <p className="text-lg font-semibold">✅ Cotización lista</p>
          <p className="text-sm text-slate-600">Total {formatMoney(creada.total, money)} · abono {formatMoney(creada.abono_requerido, money)}</p>
          <a className="btn w-full" href={waLink(whatsappFull, msg)} target="_blank" rel="noopener noreferrer">Enviar cotización por WhatsApp</a>
          <button
            className="btn-ghost w-full"
            onClick={async () => { await navigator.clipboard.writeText(creada.url).catch(() => {}); setCopiado(true); }}
          >
            {copiado ? "¡Link copiado!" : "Copiar link público"}
          </button>
          <a className="btn-ghost w-full" href={creada.url} target="_blank" rel="noopener noreferrer">Ver como la ve el cliente</a>
        </section>
        <button className="btn-ghost w-full" onClick={() => { setCreada(undefined); setQty({}); setCopiado(false); setCliente((c) => ({ ...c, nombre: "", telefono: "", notas: "" })); }}>Nueva cotización</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h2 className="font-semibold">1. Elige productos y cantidades</h2>
        {productos.map((p) => {
          const l = lineOf(p.id);
          const q = qty[p.id] ?? 0;
          return (
            <div key={p.id} className={`card flex items-center justify-between gap-3 ${q > 0 ? "border-indigo-300" : ""}`}>
              <div className="min-w-0">
                <p className="truncate font-medium">{p.nombre}</p>
                {l ? (
                  <p className="text-xs text-slate-500">{formatMoney(l.precio_unitario, money)} c/u{l.tramo_min_qty > 1 ? ` · tramo ${l.tramo_min_qty === 50 ? "50+" : l.tramo_min_qty}` : ""}{l.limitado_por_costo ? " ⚠ al costo" : ""}</p>
                ) : (
                  <p className="text-xs text-slate-400">Sin cantidad</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" aria-label={`Menos ${p.nombre}`} className="size-11 rounded-xl border border-slate-300 text-xl active:bg-slate-100" onClick={() => setQty((s) => ({ ...s, [p.id]: Math.max(0, (s[p.id] ?? 0) - (q > 12 ? 12 : 1)) }))}>−</button>
                <input aria-label={`Cantidad ${p.nombre}`} inputMode="numeric" className="input w-16 text-center" value={q || ""} placeholder="0" onChange={(e) => setQty((s) => ({ ...s, [p.id]: Math.min(100000, Number(e.target.value.replace(/\D/g, "")) || 0) }))} />
                <button type="button" aria-label={`Más ${p.nombre}`} className="size-11 rounded-xl border border-slate-300 text-xl active:bg-slate-100" onClick={() => setQty((s) => ({ ...s, [p.id]: (s[p.id] ?? 0) + 1 }))}>+</button>
              </div>
            </div>
          );
        })}
        <div className="flex gap-2 text-xs">
          <span className="self-center text-slate-500">Atajos:</span>
          {[12, 24, 50].map((n) => (
            <button key={n} type="button" className="rounded-full border border-slate-300 px-3 py-1.5 active:bg-slate-100" onClick={() => { const first = lineas[0] ?? productos[0]!; setQty((s) => ({ ...s, [first.id]: n })); }}>{n} u.</button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">2. Datos del cliente</h2>
        <input aria-label="Nombre del cliente" className="input" placeholder="Nombre del cliente" value={cliente.nombre} onChange={(e) => setCliente((c) => ({ ...c, nombre: e.target.value }))} />
        <div className="flex gap-2">
          <select aria-label="Prefijo" className="input w-36 shrink-0" value={cliente.prefix} onChange={(e) => setCliente((c) => ({ ...c, prefix: e.target.value }))}>
            {PHONE_PREFIXES.map((p) => <option key={p.prefix} value={p.prefix}>{p.label}</option>)}
          </select>
          <input aria-label="WhatsApp del cliente" inputMode="numeric" className="input" placeholder="WhatsApp" value={cliente.telefono} onChange={(e) => setCliente((c) => ({ ...c, telefono: digitsOnly(e.target.value) }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="q-plazo">Plazo de entrega (días)</label><input id="q-plazo" inputMode="numeric" className="input" value={cliente.plazo} onChange={(e) => setCliente((c) => ({ ...c, plazo: digitsOnly(e.target.value) }))} /></div>
          <div><label className="label" htmlFor="q-abono">Abono (%)</label><input id="q-abono" inputMode="decimal" className="input" value={cliente.abono} onChange={(e) => setCliente((c) => ({ ...c, abono: e.target.value }))} /></div>
        </div>
        <textarea aria-label="Notas de personalización" className="input min-h-20" placeholder="Notas de personalización (nombres, colores, tipografía…)" value={cliente.notas} onChange={(e) => setCliente((c) => ({ ...c, notas: e.target.value }))} />
      </section>

      <section aria-live="polite" className="card space-y-1">
        {preview && typeof preview !== "string" ? (
          <>
            <p className="text-sm text-slate-500">Total</p>
            <p className="text-3xl font-bold tabular-nums">{formatMoney(preview.total, money)}</p>
            <p className="text-sm text-slate-600">Abono {preview.abono_porcentaje}%: <b>{formatMoney(preview.abono_requerido, money)}</b> · saldo {formatMoney(preview.saldo, money)}</p>
          </>
        ) : (
          <p className="text-sm text-slate-500">{typeof preview === "string" ? preview : "Agrega cantidades para ver el total."}</p>
        )}
      </section>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button
        className="btn w-full"
        disabled={pending || !preview || typeof preview === "string" || !cliente.nombre.trim()}
        onClick={() => {
          setError(undefined);
          start(async () => {
            const res = await crearCotizacion({
              cliente_nombre: cliente.nombre,
              cliente_whatsapp: telefonoCompleto(cliente.prefix, cliente.telefono),
              plazo_entrega_dias: cliente.plazo || "0",
              notas_personalizacion: cliente.notas,
              abono_porcentaje: abonoPct,
              items: lineas.map((p) => ({ producto_id: p.id, cantidad: qty[p.id]! })),
            });
            if (res.ok && res.data) setCreada(res.data);
            else if (!res.ok) setError(res.error);
          });
        }}
      >
        {pending ? "Creando…" : "Crear cotización"}
      </button>

      {recientes.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Recientes</h2>
          {recientes.map((c) => (
            <a key={c.id} href={`/c/${c.slug_publico}`} className="card flex items-center justify-between gap-2">
              <span className="min-w-0"><span className="block truncate font-medium">{c.cliente_nombre}</span><span className="text-xs text-slate-500">{formatMoney(Number(c.total), money)} · abono {formatMoney(Number(c.abono_requerido), money)}</span></span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_STYLE[c.estado] ?? ""}`}>{c.estado}</span>
            </a>
          ))}
        </section>
      )}
    </div>
  );
}

function telefonoCompleto(prefix: string, telefono: string): string {
  return telefono ? `${prefix}${telefono}` : "";
}
