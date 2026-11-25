import { notFound } from "next/navigation";
import { eliminarProducto } from "@/app/actions/inventario";
import { DeleteButton } from "@/components/delete-button";
import { ProductoFormPage } from "@/components/producto-form-page";
import { getProducto, listInsumos, requireWorkspace } from "@/lib/data";

export const metadata = { title: "Editar producto" };

export default async function EditarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace: ws } = await requireWorkspace();
  const [producto, insumos] = await Promise.all([getProducto(id), listInsumos()]);
  if (!producto) notFound();
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">Editar producto</h1>
      <ProductoFormPage ws={ws} insumos={insumos} initial={producto} />
      <DeleteButton onDelete={eliminarProducto.bind(null, producto.id)} redirectTo="/productos" />
    </main>
  );
}
