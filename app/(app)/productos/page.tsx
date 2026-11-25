import Link from "next/link";
import { CostBar } from "@/components/cost-bar";
import { listProductos, requireWorkspace } from "@/lib/data";
import { formatMoney } from "@/lib/money/format";
import { productoToPricingInput } from "@/lib/pricing/adapters";
import { calculatePricing } from "@/lib/pricing/calculator";

export const metadata = { title: "Productos" };

export default async function ProductosPage() {
  const { workspace: ws } = await requireWorkspace();
  const productos = await listProductos();
  return (
    <main className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Productos</h1>
        <Link href="/productos/nuevo" className="btn !min-h-10 !px-3 !py-2 text-sm">+ Nuevo</Link>
      </header>
      {productos.length === 0 && <p className="card text-sm text-slate-500">Crea tu primer producto costeado.</p>}
      <ul className="space-y-3">
        {productos.map((p) => {
          const r = calculatePricing(productoToPricingInput(p, ws));
          return (
            <li key={p.id}>
              <Link href={`/productos/${p.id}`} className="card block space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{p.nombre}</span>
                  <span className="text-right">
                    <span className="block font-bold tabular-nums">{formatMoney(p.precio_sugerido ?? r.precio_final, ws)}</span>
                    <span className="text-xs text-slate-500">costo {formatMoney(r.costo_total_base, ws)}</span>
                  </span>
                </div>
                <CostBar desglose={r.desglose} money={ws} compact />
                <p className="text-xs text-slate-500">Ganancia neta {formatMoney(r.ganancia_neta, ws)} · margen {Number(p.margen_objetivo_pct)}%</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
