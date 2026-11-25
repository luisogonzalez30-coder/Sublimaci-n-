import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { SubscribeButton } from "@/components/subscribe-button";
import { hasActiveAccess } from "@/lib/billing/access";
import { planForCountry } from "@/lib/billing/plans";
import { getWorkspace } from "@/lib/data";
import { formatMoney } from "@/lib/money/format";
import { waLink } from "@/lib/whatsapp";

export const metadata = { title: "Activa tu plan" };

export default async function SuscripcionPage() {
  const { supabase, workspace: ws } = await getWorkspace();
  if (!ws) redirect("/onboarding");

  const [{ count: insumos }, { count: productos }, { data: cots }] = await Promise.all([
    supabase.from("insumos").select("id", { count: "exact", head: true }),
    supabase.from("productos").select("id", { count: "exact", head: true }),
    supabase.from("cotizaciones").select("total").returns<{ total: number }[]>(),
  ]);
  const cotizado = (cots ?? []).reduce((a, c) => a + Number(c.total), 0);
  const plan = planForCountry(ws.country_code);
  const activo = ws.subscription_status === "active";
  const vencido = !hasActiveAccess(ws);
  const soporte = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;

  return (
    <main className="mx-auto min-h-dvh max-w-md space-y-5 px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">{activo ? "Tu plan está activo ✅" : vencido ? "Tu prueba terminó" : "Activa tu plan"}</h1>
        <p className="mt-1 text-sm text-slate-600">{ws.nombre_taller}</p>
      </header>

      <section className="card space-y-3">
        <h2 className="font-semibold">Lo que ya armaste en tu prueba</h2>
        <ul className="grid grid-cols-3 gap-2 text-center">
          <li className="rounded-xl bg-slate-50 p-3"><b className="block text-2xl">{insumos ?? 0}</b><span className="text-xs text-slate-500">insumos</span></li>
          <li className="rounded-xl bg-slate-50 p-3"><b className="block text-2xl">{productos ?? 0}</b><span className="text-xs text-slate-500">productos costeados</span></li>
          <li className="rounded-xl bg-slate-50 p-3"><b className="block text-2xl">{cots?.length ?? 0}</b><span className="text-xs text-slate-500">cotizaciones</span></li>
        </ul>
        {cotizado > 0 && <p className="text-sm text-slate-600">Cotizaste en total <b>{formatMoney(cotizado, ws)}</b> a tus clientes.</p>}
      </section>

      {!activo && (
        <section className="card space-y-3">
          <p className="text-3xl font-bold">
            {new Intl.NumberFormat("es", { style: "currency", currency: plan.currency_id, maximumFractionDigits: 2 }).format(plan.amount)}
            <span className="text-base font-normal text-slate-500"> / mes</span>
          </p>
          <ul className="space-y-1 text-sm text-slate-700">
            <li>✓ Precio fijo mensual, <b>0% de comisión</b> sobre tus ventas</li>
            <li>✓ Tus clientes te pagan directo a tu Mercado Pago</li>
            <li>✓ Biblioteca de temporadas ilimitada y asistente IA</li>
            <li>✓ Cancela cuando quieras</li>
          </ul>
          <SubscribeButton />
        </section>
      )}

      <div className="flex items-center justify-between text-sm">
        {soporte ? <a className="font-medium text-indigo-600" href={waLink(soporte, "Hola, necesito ayuda con mi suscripción")} target="_blank" rel="noopener noreferrer">💬 Soporte por WhatsApp</a> : <span />}
        {activo ? <a href="/" className="font-medium text-indigo-600">Ir a mi taller</a> : <form action={logout}><button className="text-slate-500 underline">Salir</button></form>}
      </div>
    </main>
  );
}
