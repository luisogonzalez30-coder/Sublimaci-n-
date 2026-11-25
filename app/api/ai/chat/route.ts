import { NextResponse } from "next/server";
import { z } from "zod";
import { AI_DAILY_LIMIT, buildSystemPrompt, type AiContext } from "@/lib/ai/prompt";
import { hasActiveAccess } from "@/lib/billing/access";
import { getWorkspace, listInsumos, listProductos } from "@/lib/data";
import { formatMoney } from "@/lib/money/format";
import { productoToPricingInput } from "@/lib/pricing/adapters";
import { calculatePricing } from "@/lib/pricing/calculator";
import { generateReply } from "@/lib/services/gemini";

const schema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(1000) })).min(1).max(10),
});

export async function POST(req: Request) {
  const { supabase, workspace } = await getWorkspace();
  if (!workspace) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!hasActiveAccess(workspace)) return NextResponse.json({ error: "Tu prueba terminó" }, { status: 402 });
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "El asistente aún no está configurado" }, { status: 503 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.messages.at(-1)?.role !== "user") return NextResponse.json({ error: "Mensaje inválido" }, { status: 400 });

  // Cuota diaria atómica en Postgres (20/día por workspace).
  const { data: remaining, error } = await supabase.rpc("consumir_mensaje_ia");
  if (error) return NextResponse.json({ error: "No se pudo validar tu cuota" }, { status: 500 });
  if (remaining === -1) return NextResponse.json({ error: `Llegaste al límite de ${AI_DAILY_LIMIT} mensajes de hoy. Vuelve mañana.`, remaining: 0 }, { status: 429 });

  const [insumos, productos] = await Promise.all([listInsumos(), listProductos()]);
  const ctx: AiContext = {
    nombre_taller: workspace.nombre_taller,
    country_code: workspace.country_code,
    currency_code: workspace.currency_code,
    tax_rate_pct: Number(workspace.tax_rate_pct),
    insumos: insumos.map((i) => ({ nombre: i.nombre, unidad_medida: i.unidad_medida, costo_unitario: formatMoney(Number(i.costo_unitario), workspace) })),
    productos: productos.map((p) => ({
      nombre: p.nombre,
      precio: formatMoney(calculatePricing(productoToPricingInput(p, workspace)).precio_final, workspace),
      margen_pct: Number(p.margen_objetivo_pct),
      merma_pct: Number(p.merma_pct),
    })),
  };

  try {
    const reply = await generateReply(buildSystemPrompt(ctx), parsed.data.messages);
    return NextResponse.json({ reply, remaining });
  } catch {
    return NextResponse.json({ error: "El asistente no pudo responder. Intenta de nuevo.", remaining }, { status: 502 });
  }
}
