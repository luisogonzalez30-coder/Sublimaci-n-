import { createBrowserClient } from "@supabase/ssr";

/** Solo Client Components. Usa únicamente la anon key (RLS protege los datos). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
