"use client";

import { useState, useTransition } from "react";
import { desconectarMp, guardarTokenMp } from "@/app/actions/pagos";

export function PagosForm({ conectado }: { conectado: boolean }) {
  const [token, setToken] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [isConnected, setConnected] = useState(conectado);

  return (
    <div className="space-y-4">
      <p className={`rounded-xl p-3 text-sm font-medium ${isConnected ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
        {isConnected ? "✅ Mercado Pago conectado" : "Aún no conectado: tus clientes confirmarán por WhatsApp."}
      </p>
      <form
        className="card space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(undefined);
          start(async () => {
            const res = await guardarTokenMp(token);
            if (res.ok) { setConnected(true); setToken(""); setMsg({ ok: true, text: `Conectado${res.data?.nickname ? ` como ${res.data.nickname}` : ""}` }); }
            else setMsg({ ok: false, text: res.error });
          });
        }}
      >
        <label className="label" htmlFor="mp-token">Access Token de producción</label>
        <input id="mp-token" type="password" autoComplete="off" className="input" value={token} onChange={(e) => setToken(e.target.value)} placeholder="APP_USR-…" required />
        <p className="text-xs text-slate-500">Mercado Pago → Tu negocio → Configuración → Credenciales. Se valida con Mercado Pago y se guarda cifrado; nunca se muestra de nuevo.</p>
        {msg && <p role="status" className={`rounded-xl p-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
        <button className="btn w-full" disabled={pending}>{pending ? "Validando…" : isConnected ? "Reemplazar token" : "Validar y conectar"}</button>
      </form>
      {isConnected && (
        <button className="btn-ghost w-full" disabled={pending} onClick={() => start(async () => { const r = await desconectarMp(); if (r.ok) setConnected(false); })}>
          Desconectar
        </button>
      )}
    </div>
  );
}
