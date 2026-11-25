"use client";

import { useState } from "react";

export function SubscribeButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <div className="space-y-2">
      <button
        className="btn w-full"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(undefined);
          try {
            const res = await fetch("/api/billing/subscribe", { method: "POST" });
            const json = (await res.json()) as { init_point?: string; error?: string };
            if (res.ok && json.init_point) { window.location.href = json.init_point; return; }
            setError(json.error ?? "No se pudo iniciar la suscripción");
          } catch {
            setError("No se pudo iniciar la suscripción");
          }
          setPending(false);
        }}
      >
        {pending ? "Abriendo Mercado Pago…" : "Pagar y activar mi plan"}
      </button>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
