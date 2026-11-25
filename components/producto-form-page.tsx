"use client";

import { useRouter } from "next/navigation";
import { ProductoForm } from "@/components/producto-form";
import type { Insumo, ProductoConReceta, Workspace } from "@/lib/types";

export function ProductoFormPage({ ws, insumos, initial }: { ws: Workspace; insumos: Insumo[]; initial?: ProductoConReceta }) {
  const router = useRouter();
  return (
    <ProductoForm
      money={{ currency_code: ws.currency_code, country_code: ws.country_code, tax_rate_pct: Number(ws.tax_rate_pct) }}
      insumos={insumos}
      initial={initial}
      onSaved={() => { router.push("/productos"); router.refresh(); }}
    />
  );
}
