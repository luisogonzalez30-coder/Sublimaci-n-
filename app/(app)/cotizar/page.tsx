import { CotizadorClient } from "@/components/cotizador";
import { listProductos, requireWorkspace } from "@/lib/data";
import { productoToPricingInput } from "@/lib/pricing/adapters";

export const metadata = { title: "Cotizar" };

export default async function CotizarPage() {
  const { workspace: ws } = await requireWorkspace();
  const productos = await listProductos();
  const data = productos.map((p) => ({ id: p.id, nombre: p.nombre, input: productoToPricingInput(p, ws) }));
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">Cotizar</h1>
      <CotizadorClient productos={data} money={{ currency_code: ws.currency_code, country_code: ws.country_code }} />
    </main>
  );
}
