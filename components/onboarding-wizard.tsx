"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { crearInsumosIniciales, guardarPais } from "@/app/actions/onboarding";
import { ProductoForm } from "@/components/producto-form";
import { COUNTRIES, getCountry } from "@/lib/countries";
import type { Insumo } from "@/lib/types";

interface Props {
  initialStep: 1 | 2 | 3;
  initialCountry: string;
  initialTax?: number;
  existingInsumos: Insumo[];
}

const SUGERIDOS = [
  { key: "tazon", nombre: "Tazón blanco 11oz", categoria: "blanco", unidad_medida: "unidad" },
  { key: "dtfCm", nombre: "Metro lineal DTF 60cm (costo por cm)", categoria: "estampado", unidad_medida: "cm" },
  { key: "caja", nombre: "Caja individual", categoria: "empaque", unidad_medida: "unidad" },
] as const;

export function OnboardingWizard({ initialStep, initialCountry, initialTax, existingInsumos }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(initialStep);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  const [country, setCountry] = useState(initialCountry);
  const preset = getCountry(country);
  const [tax, setTax] = useState(String(initialTax ?? preset.taxRatePct));

  const [costs, setCosts] = useState<Record<string, string>>(() => {
    const seed = preset.seedCosts;
    return { tazon: String(seed?.tazon ?? ""), dtfCm: String(seed?.dtfCm ?? ""), caja: String(seed?.caja ?? "") };
  });
  const [insumos, setInsumos] = useState<Insumo[]>(existingInsumos);

  const money = { currency_code: preset.currency, country_code: preset.code, tax_rate_pct: Number(tax.replace(",", ".")) || 0 };

  const onCountry = (code: string) => {
    const p = getCountry(code);
    setCountry(code);
    setTax(String(p.taxRatePct));
    setCosts({ tazon: String(p.seedCosts?.tazon ?? ""), dtfCm: String(p.seedCosts?.dtfCm ?? ""), caja: String(p.seedCosts?.caja ?? "") });
  };

  const run = (fn: () => Promise<{ ok: boolean; error?: string } | void>) => {
    setError(undefined);
    start(async () => {
      const res = await fn();
      if (res && !res.ok) setError(res.error);
    });
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-indigo-600">Paso {step} de 3</p>
        <div className="mt-2 flex gap-1.5" aria-hidden>
          {[1, 2, 3].map((n) => <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-indigo-600" : "bg-slate-200"}`} />)}
        </div>
      </header>

      {step === 1 && (
        <section className="space-y-4">
          <h1 className="text-2xl font-bold">¿Dónde está tu taller?</h1>
          <div>
            <label className="label" htmlFor="o-pais">País</label>
            <select id="o-pais" value={country} onChange={(e) => onCountry(e.target.value)} className="input">
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="o-moneda">Moneda</label>
              <input id="o-moneda" readOnly value={preset.currency} className="input bg-slate-100" />
            </div>
            <div>
              <label className="label" htmlFor="o-tax">{preset.taxLabel} (%)</label>
              <input id="o-tax" inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} className="input" />
            </div>
          </div>
          <button
            className="btn w-full"
            disabled={pending}
            onClick={() => run(async () => {
              const res = await guardarPais({ country_code: country, tax_rate_pct: tax });
              if (res.ok) setStep(2);
              return res;
            })}
          >
            {pending ? "Guardando…" : "Continuar"}
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <h1 className="text-2xl font-bold">Tus primeros insumos</h1>
          <p className="text-sm text-slate-600">Ajusta el costo de cada uno ({preset.currency}). Luego podrás agregar más.</p>
          {SUGERIDOS.map((s) => (
            <div key={s.key}>
              <label className="label" htmlFor={`o-${s.key}`}>{s.nombre}</label>
              <input
                id={`o-${s.key}`}
                inputMode="decimal"
                value={costs[s.key] ?? ""}
                onChange={(e) => setCosts((c) => ({ ...c, [s.key]: e.target.value }))}
                className="input"
                placeholder={`Costo por ${s.unidad_medida}`}
              />
            </div>
          ))}
          <button
            className="btn w-full"
            disabled={pending}
            onClick={() => run(async () => {
              const res = await crearInsumosIniciales(
                SUGERIDOS.map((s) => ({ nombre: s.nombre, categoria: s.categoria, unidad_medida: s.unidad_medida, costo_unitario: costs[s.key] ?? "0", stock_actual: 0 })),
              );
              if (res.ok && res.data) { setInsumos(res.data); setStep(3); }
              return res;
            })}
          >
            {pending ? "Guardando…" : "Continuar"}
          </button>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <h1 className="text-2xl font-bold">Tu primer producto</h1>
          <p className="text-sm text-slate-600">Mira el precio y la ganancia en vivo mientras ajustas.</p>
          <ProductoForm
            money={money}
            insumos={insumos}
            defaults={{
              nombre: "Tazón sublimado personalizado",
              items: [insumos.find((i) => i.categoria === "blanco"), insumos.find((i) => i.categoria === "empaque")]
                .filter((i): i is Insumo => Boolean(i))
                .map((i) => ({ insumo_id: i.id, cantidad: "1" })),
            }}
            submitLabel="Crear producto y entrar"
            onSaved={() => { router.replace("/"); router.refresh(); }}
          />
        </section>
      )}

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
