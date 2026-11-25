import { formatMoney, type MoneyContext } from "@/lib/money/format";
import type { PricingBreakdown } from "@/lib/pricing/calculator";

const SEGMENTS = [
  { key: "materiales", label: "Materiales", color: "bg-indigo-500" },
  { key: "merma", label: "Merma", color: "bg-amber-400" },
  { key: "mano_obra", label: "Mano de obra y gastos", color: "bg-slate-400" },
  { key: "ganancia_neta", label: "Ganancia neta", color: "bg-emerald-500" },
] as const;

/** Barra de desglose del precio neto: Materiales vs. Merma vs. Mano de obra vs. Ganancia. */
export function CostBar({ desglose, money, compact = false }: { desglose: PricingBreakdown; money: MoneyContext; compact?: boolean }) {
  const values: Record<(typeof SEGMENTS)[number]["key"], number> = {
    materiales: desglose.materiales,
    merma: desglose.merma,
    mano_obra: desglose.mano_obra + desglose.gastos_fijos,
    ganancia_neta: desglose.ganancia_neta,
  };
  const total = Object.values(values).reduce((a, b) => a + b, 0);
  if (total <= 0) return null;

  return (
    <div>
      <div role="img" aria-label="Desglose del precio" className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        {SEGMENTS.map((s) => (
          <div key={s.key} className={s.color} style={{ width: `${(values[s.key] / total) * 100}%` }} />
        ))}
      </div>
      {!compact && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {SEGMENTS.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span className={`inline-block size-3 rounded-full ${s.color}`} />
                {s.label} <span className="text-slate-400">{Math.round((values[s.key] / total) * 100)}%</span>
              </span>
              <span className="font-medium tabular-nums">{formatMoney(values[s.key], money)}</span>
            </li>
          ))}
          {desglose.impuesto > 0 && (
            <li className="flex justify-between gap-2 border-t border-slate-100 pt-1.5 text-slate-500">
              <span>Impuesto (sobre el neto)</span>
              <span className="tabular-nums">{formatMoney(desglose.impuesto, money)}</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
