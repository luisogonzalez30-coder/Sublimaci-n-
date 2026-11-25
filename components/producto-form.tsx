"use client";

import { useMemo, useState, useTransition } from "react";
import { guardarProducto } from "@/app/actions/inventario";
import { CostBar } from "@/components/cost-bar";
import { formatMoney, type MoneyContext } from "@/lib/money/format";
import { PricingError, calculatePricing } from "@/lib/pricing/calculator";
import type { Insumo, ProductoConReceta } from "@/lib/types";

type Money = MoneyContext & { tax_rate_pct: number };
type InsumoLite = Pick<Insumo, "id" | "nombre" | "costo_unitario" | "unidad_medida">;
interface Line { insumo_id: string; cantidad: string }

const toNum = (s: string) => (s.trim() === "" ? 0 : Number(s.trim().replace(",", ".")));

export interface ProductoFormProps {
  money: Money;
  insumos: InsumoLite[];
  initial?: ProductoConReceta;
  /** Valores iniciales para creación (onboarding). */
  defaults?: { nombre?: string; items?: Line[] };
  submitLabel?: string;
  onSaved: () => void;
}

export function ProductoForm({ money, insumos, initial, defaults, submitLabel = "Guardar producto", onSaved }: ProductoFormProps) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [f, setF] = useState({
    nombre: initial?.nombre ?? defaults?.nombre ?? "",
    merma_pct: String(initial?.merma_pct ?? 10),
    mano_obra_fija: String(initial?.mano_obra_fija ?? 0),
    gastos_fijos_prorrateo: String(initial?.gastos_fijos_prorrateo ?? 0),
    margen_objetivo_pct: String(initial?.margen_objetivo_pct ?? 45),
    aplica_iva: initial?.aplica_iva ?? false,
  });
  const [lines, setLines] = useState<Line[]>(
    initial?.producto_insumos.map((pi) => ({ insumo_id: pi.insumo_id, cantidad: String(pi.cantidad_requerida) })) ?? defaults?.items ?? [],
  );
  const byId = useMemo(() => new Map(insumos.map((i) => [i.id, i])), [insumos]);
  const available = insumos.filter((i) => !lines.some((l) => l.insumo_id === i.id));
  const set = (k: "nombre" | "merma_pct" | "mano_obra_fija" | "gastos_fijos_prorrateo" | "margen_objetivo_pct") =>
    (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const preview = useMemo(() => {
    try {
      return {
        result: calculatePricing({
          items: lines.map((l) => ({ cantidad_requerida: toNum(l.cantidad), costo_unitario: Number(byId.get(l.insumo_id)?.costo_unitario ?? 0) })),
          merma_pct: toNum(f.merma_pct),
          mano_obra_fija: toNum(f.mano_obra_fija),
          gastos_fijos_prorrateo: toNum(f.gastos_fijos_prorrateo),
          margen_objetivo_pct: toNum(f.margen_objetivo_pct),
          aplica_iva: f.aplica_iva,
          tax_rate_pct: money.tax_rate_pct,
        }),
      };
    } catch (e) {
      return { error: e instanceof PricingError ? e.message : "Revisa los valores" };
    }
  }, [lines, f, byId, money.tax_rate_pct]);

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        start(async () => {
          const res = await guardarProducto({
            id: initial?.id,
            ...f,
            items: lines.filter((l) => toNum(l.cantidad) > 0).map((l) => ({ insumo_id: l.insumo_id, cantidad_requerida: toNum(l.cantidad) })),
          });
          if (res.ok) onSaved();
          else setError(res.error);
        });
      }}
    >
      <div>
        <label className="label" htmlFor="p-nombre">Nombre del producto</label>
        <input id="p-nombre" required value={f.nombre} onChange={set("nombre")} className="input" placeholder="Ej: Tazón sublimado personalizado" />
      </div>

      <fieldset className="space-y-2">
        <legend className="label">Insumos por unidad</legend>
        {lines.map((l) => {
          const ins = byId.get(l.insumo_id);
          return (
            <div key={l.insumo_id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm">{ins?.nombre}</span>
              <input
                aria-label={`Cantidad de ${ins?.nombre} (${ins?.unidad_medida})`}
                inputMode="decimal"
                value={l.cantidad}
                onChange={(e) => setLines((ls) => ls.map((x) => (x.insumo_id === l.insumo_id ? { ...x, cantidad: e.target.value } : x)))}
                className="input w-24 text-right"
              />
              <span className="w-12 text-xs text-slate-500">{ins?.unidad_medida}</span>
              <button type="button" aria-label="Quitar insumo" className="size-10 rounded-lg text-slate-400 active:bg-slate-100" onClick={() => setLines((ls) => ls.filter((x) => x.insumo_id !== l.insumo_id))}>✕</button>
            </div>
          );
        })}
        {available.length > 0 && (
          <select
            aria-label="Agregar insumo"
            className="input"
            value=""
            onChange={(e) => e.target.value && setLines((ls) => [...ls, { insumo_id: e.target.value, cantidad: "1" }])}
          >
            <option value="">+ Agregar insumo…</option>
            {available.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          </select>
        )}
        {insumos.length === 0 && <p className="text-sm text-slate-500">Primero crea insumos en la sección Insumos.</p>}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="p-merma">Merma (%)</label>
          <input id="p-merma" inputMode="decimal" value={f.merma_pct} onChange={set("merma_pct")} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="p-margen">Margen objetivo (%)</label>
          <input id="p-margen" inputMode="decimal" value={f.margen_objetivo_pct} onChange={set("margen_objetivo_pct")} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="p-mo">Mano de obra ({money.currency_code})</label>
          <input id="p-mo" inputMode="decimal" value={f.mano_obra_fija} onChange={set("mano_obra_fija")} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="p-gf">Gastos fijos prorrateo</label>
          <input id="p-gf" inputMode="decimal" value={f.gastos_fijos_prorrateo} onChange={set("gastos_fijos_prorrateo")} className="input" />
        </div>
      </div>

      <label className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3">
        <input type="checkbox" className="size-5" checked={f.aplica_iva} onChange={(e) => setF((s) => ({ ...s, aplica_iva: e.target.checked }))} />
        <span className="text-sm">Sumar impuesto al precio final ({money.tax_rate_pct}%)</span>
      </label>

      <section aria-live="polite" className="card space-y-3">
        {"result" in preview && preview.result ? (
          <>
            <div className="flex items-end justify-between">
              <span className="text-sm text-slate-500">Precio sugerido (1 unidad)</span>
              <span className="text-2xl font-bold tabular-nums">{formatMoney(preview.result.precio_final, money)}</span>
            </div>
            <p className="text-xs text-slate-500">Costo total base: {formatMoney(preview.result.costo_total_base, money)}</p>
            <CostBar desglose={preview.result.desglose} money={money} />
          </>
        ) : (
          <p className="text-sm text-red-600">{"error" in preview ? preview.error : ""}</p>
        )}
      </section>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={pending || !("result" in preview && preview.result)} className="btn w-full">{pending ? "Guardando…" : submitLabel}</button>
    </form>
  );
}
