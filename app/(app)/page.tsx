import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { CostBar } from "@/components/cost-bar";
import { listInsumos, listProductos, requireWorkspace } from "@/lib/data";
import { formatMoney } from "@/lib/money/format";
import { calculatePricing } from "@/lib/pricing/calculator";
import { productoToPricingInput } from "@/lib/pricing/adapters";

export const metadata = { title: "Inicio" };

export default async function InicioPage() {
  const { workspace: ws } = await requireWorkspace();
  const [insumos, productos] = await Promise.all([listInsumos(), listProductos()]);
  const diasTrial = Math.ceil((new Date(ws.trial_ends_at).getTime() - Date.now()) / 86_400_000);
  const enTrial = ws.subscription_status === "trialing";

  return (
    <main className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Hola 👋</p>
          <h1 className="text-2xl font-bold">{ws.nombre_taller}</h1>
        </div>
        <form action={logout}><button className="text-sm text-slate-500 underline">Salir</button></form>
      </header>

      {enTrial && (
        <p className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-800">
          {diasTrial > 0 ? `Te quedan ${diasTrial} día${diasTrial === 1 ? "" : "s"} de prueba.` : "Tu prueba terminó."}
        </p>
      )}

      <section className="grid grid-cols-2 gap-3">
        <Link href="/insumos" className="card"><p className="text-3xl font-bold">{insumos.length}</p><p className="text-sm text-slate-500">Insumos</p></Link>
        <Link href="/productos" className="card"><p className="text-3xl font-bold">{productos.length}</p><p className="text-sm text-slate-500">Productos</p></Link>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Tus productos</h2>
        {productos.length === 0 && <Link href="/productos/nuevo" className="btn w-full">Crear mi primer producto</Link>}
        {productos.slice(0, 5).map((p) => {
          const r = calculatePricing(productoToPricingInput(p, ws));
          return (
            <Link key={p.id} href={`/productos/${p.id}`} className="card block space-y-2">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{p.nombre}</span>
                <span className="font-bold tabular-nums">{formatMoney(r.precio_final, ws)}</span>
              </div>
              <CostBar desglose={r.desglose} money={ws} compact />
            </Link>
          );
        })}
      </section>
    </main>
  );
}
