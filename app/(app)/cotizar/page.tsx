import { CotizadorClient } from "@/components/cotizador";
import { listProductos, requireWorkspace } from "@/lib/data";
import { productoToPricingInput } from "@/lib/pricing/adapters";
import type { CotizacionResumen } from "@/lib/types";

export const metadata = { title: "Cotizar" };

export default async function CotizarPage() {
  const { workspace: ws, supabase } = await requireWorkspace();
  const [productos, { data: recientes }] = await Promise.all([
    listProductos(),
    supabase
      .from("cotizaciones")
      .select("id, cliente_nombre, cliente_whatsapp, total, abono_requerido, abono_porcentaje, estado, slug_publico, created_at")
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<CotizacionResumen[]>(),
  ]);
  const data = productos.map((p) => ({ id: p.id, nombre: p.nombre, input: productoToPricingInput(p, ws) }));
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">Cotizar</h1>
      <CotizadorClient
        productos={data}
        recientes={recientes ?? []}
        workspace={{ nombre_taller: ws.nombre_taller, currency_code: ws.currency_code, country_code: ws.country_code }}
      />
    </main>
  );
}
