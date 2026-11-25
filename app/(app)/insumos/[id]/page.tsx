import { notFound } from "next/navigation";
import { eliminarInsumo } from "@/app/actions/inventario";
import { DeleteButton } from "@/components/delete-button";
import { InsumoForm } from "@/components/insumo-form";
import { listInsumos, requireWorkspace } from "@/lib/data";

export const metadata = { title: "Editar insumo" };

export default async function EditarInsumoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace: ws } = await requireWorkspace();
  const insumo = (await listInsumos()).find((i) => i.id === id);
  if (!insumo) notFound();
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">Editar insumo</h1>
      <InsumoForm initial={insumo} currency={ws.currency_code} />
      <DeleteButton onDelete={eliminarInsumo.bind(null, insumo.id)} redirectTo="/insumos" />
    </main>
  );
}
