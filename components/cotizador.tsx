"use client";

import { useState } from "react";
import { formatMoney, type MoneyContext } from "@/lib/money/format";
import { calculateVolumeTable, pickTier, type PricingInput } from "@/lib/pricing/calculator";

interface Item { id: string; nombre: string; input: PricingInput }

export function CotizadorClient({ productos, money }: { productos: Item[]; money: MoneyContext }) {
  const [id, setId] = useState(productos[0]?.id ?? "");
  const [qty, setQty] = useState("1");
  const prod = productos.find((p) => p.id === id);
  if (!prod) return <p className="card text-sm text-slate-500">Crea un producto para poder cotizar.</p>;

  const rows = calculateVolumeTable(prod.input);
  const q = Math.max(1, Math.floor(Number(qty) || 1));
  const tier = pickTier(rows, q)!;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <div>
          <label className="label" htmlFor="c-prod">Producto</label>
          <select id="c-prod" value={id} onChange={(e) => setId(e.target.value)} className="input">
            {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="c-qty">Cantidad</label>
          <input id="c-qty" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} className="input text-right" />
        </div>
      </div>

      <section className="card space-y-1">
        <p className="text-sm text-slate-500">Total para {q} unidad{q === 1 ? "" : "es"}</p>
        <p className="text-3xl font-bold tabular-nums">{formatMoney(tier.precio_unitario_final * q, money)}</p>
        <p className="text-sm text-slate-500">{formatMoney(tier.precio_unitario_final, money)} c/u{prod.input.aplica_iva ? " (impuesto incluido)" : ""}</p>
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">Precios por volumen</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr><th className="py-1">Desde</th><th className="text-right">Precio c/u</th><th className="text-right">Margen</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.min_qty} className={r.min_qty === tier.min_qty ? "bg-indigo-50 font-semibold" : ""}>
                <td className="py-2 pl-1">{r.min_qty === 50 ? "50+" : r.min_qty} u.</td>
                <td className="text-right tabular-nums">{formatMoney(r.precio_unitario_final, money)}</td>
                <td className="pr-1 text-right tabular-nums">{r.margen_efectivo_pct}%{r.limitado_por_costo ? " ⚠" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.some((r) => r.limitado_por_costo) && (
          <p className="mt-2 text-xs text-amber-700">⚠ El margen del producto es menor al descuento del tramo: se vende al costo, nunca bajo él.</p>
        )}
      </section>
    </div>
  );
}
