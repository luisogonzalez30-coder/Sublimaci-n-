"use client";

import { useRef, useState } from "react";
import { AI_DAILY_LIMIT } from "@/lib/ai/prompt";

interface Msg { role: "user" | "assistant"; content: string }
const SUGERENCIAS = ["¿A cuánto vendo 24 tazones por mayor?", "¿Temperatura y tiempo para sublimar un tazón?", "Escríbeme un mensaje de venta para WhatsApp"];

export function AssistantChat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [remaining, setRemaining] = useState<number>();
  const bottom = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    const next = [...msgs, { role: "user" as const, content }];
    setMsgs(next);
    setInput("");
    setError(undefined);
    setPending(true);
    try {
      const res = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next.slice(-10) }) });
      const json = (await res.json()) as { reply?: string; error?: string; remaining?: number };
      if (typeof json.remaining === "number") setRemaining(json.remaining);
      if (res.ok && json.reply) setMsgs([...next, { role: "assistant", content: json.reply }]);
      else setError(json.error ?? "No se pudo responder");
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
    }
    setPending(false);
    setTimeout(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  return (
    <div className="space-y-3">
      {msgs.length === 0 && (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">Pregunta por costeo, precios por mayor, planchado o mensajes de venta. Conozco tus insumos y productos.</p>
          {SUGERENCIAS.map((s) => <button key={s} className="btn-ghost w-full !justify-start text-left text-sm" onClick={() => send(s)}>{s}</button>)}
        </div>
      )}
      <ul className="space-y-2">
        {msgs.map((m, i) => (
          <li key={i} className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${m.role === "user" ? "ml-8 bg-indigo-600 text-white" : "mr-8 bg-white shadow-sm ring-1 ring-slate-200"}`}>{m.content}</li>
        ))}
        {pending && <li className="mr-8 rounded-2xl bg-white px-4 py-3 text-sm text-slate-400 ring-1 ring-slate-200">Pensando…</li>}
      </ul>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div ref={bottom} />
      <form className="sticky bottom-20 flex gap-2 bg-slate-50 py-2" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
        <input aria-label="Tu pregunta" className="input" maxLength={1000} placeholder="Escribe tu pregunta…" value={input} onChange={(e) => setInput(e.target.value)} />
        <button className="btn shrink-0" disabled={pending || !input.trim()}>Enviar</button>
      </form>
      <p className="text-center text-xs text-slate-400">{remaining !== undefined ? `${remaining} de ${AI_DAILY_LIMIT} mensajes restantes hoy` : `Límite: ${AI_DAILY_LIMIT} mensajes por día`}</p>
    </div>
  );
}
