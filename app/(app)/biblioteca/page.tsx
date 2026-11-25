import { ImportButton } from "@/components/import-button";
import { requireWorkspace } from "@/lib/data";
import type { Plantilla } from "@/lib/types";

export const metadata = { title: "Biblioteca de temporadas" };

export default async function BibliotecaPage() {
  const { supabase, workspace: ws } = await requireWorkspace();
  const { data } = await supabase
    .from("plantillas_temporada")
    .select("id, slug, nombre, descripcion, emoji, publicar_desde, publicar_hasta, solo_pro")
    .order("publicar_desde", { ascending: true, nullsFirst: true })
    .returns<Plantilla[]>();
  const hoy = new Date().toISOString().slice(0, 10);
  const pro = ws.subscription_status === "active";
  const { data: usados } = await supabase.from("workspaces").select("biblioteca_imports_usados").eq("id", ws.id).single<{ biblioteca_imports_usados: number }>();
  const trialAgotado = !pro && (usados?.biblioteca_imports_usados ?? 0) >= 1;

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">Biblioteca de temporadas</h1>
      <p className="text-sm text-slate-600">
        Importa insumos y productos ya costeados con los precios de tu país. {pro ? "Importaciones ilimitadas." : "En la prueba puedes importar 1 pack."}
      </p>
      <ul className="space-y-3">
        {(data ?? []).map((t) => {
          const aun = t.publicar_desde && hoy < t.publicar_desde;
          const fin = t.publicar_hasta && hoy > t.publicar_hasta;
          const bloqueo = aun ? `Disponible desde ${t.publicar_desde}` : fin ? "Temporada finalizada" : t.solo_pro && !pro ? "Solo suscriptores" : trialAgotado ? "Activa tu plan para importar más" : null;
          return (
            <li key={t.id} className="card space-y-2">
              <p className="text-lg font-semibold">{t.emoji} {t.nombre} {t.solo_pro && <span className="ml-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">PRO</span>}</p>
              <p className="text-sm text-slate-600">{t.descripcion}</p>
              {bloqueo ? <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-600">{bloqueo}</p> : <ImportButton plantillaId={t.id} />}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
