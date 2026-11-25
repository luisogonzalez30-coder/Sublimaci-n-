import { PagosForm } from "@/components/pagos-form";
import { requireWorkspace } from "@/lib/data";

export const metadata = { title: "Cobros con Mercado Pago" };

export default async function PagosPage() {
  const { workspace: ws } = await requireWorkspace();
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">Cobros con Mercado Pago</h1>
      <p className="text-sm text-slate-600">
        Conecta TU cuenta: tus clientes pagan el abono directo a ti. No cobramos comisión por tus ventas ni tocamos tu dinero.
      </p>
      <PagosForm conectado={ws.mp_conectado} />
    </main>
  );
}
