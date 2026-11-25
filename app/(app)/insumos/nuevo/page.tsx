import { InsumoForm } from "@/components/insumo-form";
import { requireWorkspace } from "@/lib/data";

export const metadata = { title: "Nuevo insumo" };

export default async function NuevoInsumoPage() {
  const { workspace: ws } = await requireWorkspace();
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">Nuevo insumo</h1>
      <InsumoForm currency={ws.currency_code} />
    </main>
  );
}
