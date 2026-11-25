import { ProductoFormPage } from "@/components/producto-form-page";
import { listInsumos, requireWorkspace } from "@/lib/data";

export const metadata = { title: "Nuevo producto" };

export default async function NuevoProductoPage() {
  const { workspace: ws } = await requireWorkspace();
  const insumos = await listInsumos();
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">Nuevo producto</h1>
      <ProductoFormPage ws={ws} insumos={insumos} />
    </main>
  );
}
