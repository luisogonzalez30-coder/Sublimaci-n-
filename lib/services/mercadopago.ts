import "server-only";

const MP_API = "https://api.mercadopago.com";

export class MpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "MpError";
  }
}

type FetchLike = typeof fetch;

/** Cliente REST mínimo. El token solo viaja en el header; jamás se loguea ni se incluye en errores. */
async function mp<T>(method: "GET" | "POST", path: string, token: string, body?: unknown, f: FetchLike = fetch): Promise<T> {
  const res = await f(`${MP_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!res.ok) throw new MpError(res.status, `Mercado Pago respondió ${res.status} en ${method} ${path.split("?")[0]}`);
  return (await res.json()) as T;
}

export interface MpUser { id: number; nickname?: string; site_id?: string }
export const getMpUser = (token: string, f?: FetchLike) => mp<MpUser>("GET", "/users/me", token, undefined, f);

export interface MpPreference { id: string; init_point: string }
export interface PreferenceInput {
  title: string;
  amount: number;
  currency_id: string;
  external_reference: string;
  notification_url: string;
  back_url: string;
}
/** Checkout Pro con el token DEL TALLER: el dinero va directo a su cuenta (sin marketplace_fee). */
export const createPreference = (token: string, i: PreferenceInput, f?: FetchLike) =>
  mp<MpPreference>("POST", "/checkout/preferences", token, {
    items: [{ title: i.title, quantity: 1, unit_price: i.amount, currency_id: i.currency_id }],
    external_reference: i.external_reference,
    notification_url: i.notification_url,
    back_urls: { success: i.back_url, pending: i.back_url, failure: i.back_url },
    auto_return: "approved",
  }, f);

export interface MpPayment {
  id: number;
  status: string;
  external_reference: string | null;
  transaction_amount: number;
  currency_id: string;
}
export const getPayment = (token: string, id: string, f?: FetchLike) => mp<MpPayment>("GET", `/v1/payments/${encodeURIComponent(id)}`, token, undefined, f);

export interface MpPreapproval {
  id: string;
  status: string;
  external_reference: string | null;
  init_point?: string;
  last_modified?: string;
}
export const createPreapproval = (platformToken: string, body: unknown, f?: FetchLike) => mp<MpPreapproval>("POST", "/preapproval", platformToken, body, f);
export const getPreapproval = (platformToken: string, id: string, f?: FetchLike) => mp<MpPreapproval>("GET", `/preapproval/${encodeURIComponent(id)}`, platformToken, undefined, f);
