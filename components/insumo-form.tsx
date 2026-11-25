"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { guardarInsumo } from "@/app/actions/inventario";
import { CATEGORIAS, CATEGORIA_LABEL, UNIDADES, type Insumo } from "@/lib/types";

export function InsumoForm({ initial, currency }: { initial?: Insumo; currency: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [v, setV] = useState({
    nombre: initial?.nombre ?? "",
    categoria: initial?.categoria ?? "blanco",
    unidad_medida: initial?.unidad_medida ?? "unidad",
    costo_unitario: String(initial?.costo_unitario ?? ""),
    stock_actual: String(initial?.stock_actual ?? "0"),
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        start(async () => {
          const res = await guardarInsumo({ ...v, id: initial?.id });
          if (res.ok) { router.push("/insumos"); router.refresh(); }
          else setError(res.error);
        });
      }}
    >
      <div>
        <label className="label" htmlFor="nombre">Nombre</label>
        <input id="nombre" required value={v.nombre} onChange={set("nombre")} className="input" placeholder="Ej: Tazón blanco 11oz" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="categoria">Categoría</label>
          <select id="categoria" value={v.categoria} onChange={set("categoria")} className="input">
            {CATEGORIAS.map((c) => <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="unidad">Unidad</label>
          <select id="unidad" value={v.unidad_medida} onChange={set("unidad_medida")} className="input">
            {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="costo">Costo por {v.unidad_medida} ({currency})</label>
          <input id="costo" required inputMode="decimal" value={v.costo_unitario} onChange={set("costo_unitario")} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="stock">Stock actual</label>
          <input id="stock" inputMode="decimal" value={v.stock_actual} onChange={set("stock_actual")} className="input" />
        </div>
      </div>
      {initial && <p className="text-xs text-slate-500">Al cambiar el costo, el precio de todos los productos que usan este insumo se recalcula al instante.</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={pending} className="btn w-full">{pending ? "Guardando…" : "Guardar insumo"}</button>
    </form>
  );
}
