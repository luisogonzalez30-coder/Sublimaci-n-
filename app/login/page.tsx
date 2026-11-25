"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

export default function LoginPage() {
  const [state, action] = useActionState(login, {});
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">Ingresa a tu taller</h1>
        <p className="mt-1 text-sm text-slate-600">Costea, cotiza y cobra con precios siempre al día.</p>
      </header>
      <form action={action} className="card space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="password">Contraseña</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
        </div>
        <FormMessage state={state} />
        <SubmitButton>Ingresar</SubmitButton>
      </form>
      <p className="text-center text-sm text-slate-600">
        ¿Sin cuenta? <Link href="/registro" className="font-semibold text-indigo-600">Prueba 5 días gratis</Link>
      </p>
    </main>
  );
}
