import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { accessRedirect, isOperationalPath, type AccessState } from "@/lib/billing/access";

const PUBLIC_PATHS = ["/login", "/registro", "/auth", "/c", "/api/quotes", "/api/webhooks"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getUser() valida el JWT contra Supabase Auth (getSession() no es confiable en servidor).
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (user && (path === "/login" || path === "/registro")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Guard de trial/suscripción (server-side): trial vencido y sin plan activo ⇒ Paywall.
  if (user && isOperationalPath(path)) {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("trial_ends_at, subscription_status")
      .eq("owner_id", user.id)
      .maybeSingle<AccessState>();
    const target = accessRedirect(path, ws ?? null);
    if (target) {
      const url = request.nextUrl.clone();
      url.pathname = target;
      url.search = "";
      return NextResponse.redirect(url);
    }
  }
  return response;
}
