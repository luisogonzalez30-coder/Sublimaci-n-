import Link from "next/link";
import { listInsumos, requireWorkspace } from "@/lib/data";
import { formatMoney } from "@/lib/money/format";
import { CATEGORIA_LABEL } from "@/lib/types";

export const metadata = { title: "Insumos" };

export default async function InsumosPage() {
  const { workspace: ws } = await requireWorkspace();
  const insumos = await listInsumos();
  return (
    <main className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Insumos</h1>
        <Link href="/insumos/nuevo" className="btn !min-h-10 !px-3 !py-2 text-sm">+ Nuevo</Link>
      </header>
      {insumos.length === 0 && <p className="card text-sm text-slate-500">Aún no tienes insumos. Agrega tazones, películas DTF, cajas…</p>}
      <ul className="space-y-2">
        {insumos.map((i) => (
          <li key={i.id}>
            <Link href={`/insumos/${i.id}`} className="card flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate font-medium">{i.nombre}</span>
                <span className="text-xs text-slate-500">{CATEGORIA_LABEL[i.categoria]} · stock {Number(i.stock_actual)} {i.unidad_medida}</span>
              </span>
              <span className="text-right">
                <span className="block font-semibold tabular-nums">{formatMoney(Number(i.costo_unitario), ws)}</span>
                <span className="text-xs text-slate-500">por {i.unidad_medida}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
