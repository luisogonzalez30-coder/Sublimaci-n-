/** Guard de trial/suscripción. Puro: usado por middleware, layouts y Server Actions. */
export interface AccessState {
  trial_ends_at: string | Date;
  subscription_status: string;
}

const OPERATIONAL_PREFIXES = ["/dashboard", "/insumos", "/productos", "/cotizar", "/asistente", "/biblioteca", "/configuracion"];

export const PAYWALL_PATH = "/suscripcion";

export function isOperationalPath(pathname: string): boolean {
  return pathname === "/" || OPERATIONAL_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Acceso = suscripción activa, o trial vigente (now < trial_ends_at). */
export function hasActiveAccess(ws: AccessState, now: Date = new Date()): boolean {
  if (ws.subscription_status === "active") return true;
  return now.getTime() < new Date(ws.trial_ends_at).getTime();
}

/** Devuelve la ruta a la que redirigir, o null si puede continuar. */
export function accessRedirect(pathname: string, ws: AccessState | null, now: Date = new Date()): string | null {
  if (!ws || !isOperationalPath(pathname)) return null;
  return hasActiveAccess(ws, now) ? null : PAYWALL_PATH;
}

export const TRIAL_ENDED_MESSAGE = "Tu prueba terminó. Activa tu plan para seguir usando la app.";
