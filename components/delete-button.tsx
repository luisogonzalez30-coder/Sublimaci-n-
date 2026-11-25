"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/validation";

export function DeleteButton({ onDelete, redirectTo, label = "Eliminar" }: { onDelete: () => Promise<ActionResult>; redirectTo: string; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className="min-h-12 w-full rounded-xl border border-red-200 bg-white px-4 text-base font-medium text-red-600 active:bg-red-50 disabled:opacity-60"
        onClick={() => {
          if (!window.confirm("¿Eliminar definitivamente?")) return;
          start(async () => {
            const res = await onDelete();
            if (res.ok) router.push(redirectTo);
            else setError(res.error);
          });
        }}
      >
        {pending ? "Eliminando…" : label}
      </button>
      {error && <p role="alert" className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
