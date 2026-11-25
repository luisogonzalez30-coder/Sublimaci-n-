"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registro } from "@/app/actions/auth";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { PHONE_PREFIXES } from "@/lib/countries";

export default function RegistroPage() {
  const [state, action] = useActionState(registro, {});
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">Crea tu cuenta</h1>
        <p className="mt-1 text-sm text-slate-600">5 días de prueba. Sin tarjeta de crédito.</p>
      </header>
      <form action={action} className="card space-y-4">
        <div>
          <label className="label" htmlFor="nombre_taller">Nombre del taller</label>
          <input id="nombre_taller" name="nombre_taller" required minLength={2} maxLength={80} className="input" placeholder="Ej: Sublimados Sofi" />
        </div>
        <div>
          <label className="label" htmlFor="telefono">WhatsApp</label>
          <div className="flex gap-2">
            <select name="prefix" aria-label="Prefijo país" className="input w-36 shrink-0" defaultValue="+56">
              {PHONE_PREFIXES.map((p) => <option key={p.prefix} value={p.prefix}>{p.label}</option>)}
            </select>
            <input id="telefono" name="telefono" type="tel" inputMode="numeric" autoComplete="tel-national" required className="input" placeholder="912345678" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="password">Contraseña</label>
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className="input" />
        </div>
        <FormMessage state={state} />
        <SubmitButton>Crear cuenta</SubmitButton>
      </form>
      <p className="text-center text-sm text-slate-600">
        ¿Ya tienes cuenta? <Link href="/login" className="font-semibold text-indigo-600">Ingresar</Link>
      </p>
    </main>
  );
}
