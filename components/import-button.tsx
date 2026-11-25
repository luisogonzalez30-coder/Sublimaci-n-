"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { importarPlantilla } from "@/app/actions/biblioteca";

export function ImportButton({ plantillaId }: { plantillaId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  return (
    <div className="space-y-2">
      <button
        className="btn w-full"
        disabled={pending}
        onClick={() => start(async () => {
          const r = await importarPlantilla(plantillaId);
          if (r.ok && r.data) { setMsg({ ok: true, text: `Listo: ${r.data.productos_creados} producto(s) y ${r.data.insumos_creados} insumo(s) nuevos.` }); router.refresh(); }
          else if (!r.ok) setMsg({ ok: false, text: r.error });
        })}
      >
        {pending ? "Importando…" : "Importar y costear en mi taller"}
      </button>
      {msg && <p role="status" className={`rounded-xl p-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
    </div>
  );
}
