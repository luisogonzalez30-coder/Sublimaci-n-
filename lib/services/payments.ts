export interface PaymentLike { status: string; external_reference: string | null; transaction_amount: number; currency_id: string }
export interface CotizacionLike { id: string; estado: string; abono_requerido: number }

export type PaymentDecision = { action: "abonar" } | { action: "ignorar"; reason: string };

/** Decide si un pago de Mercado Pago (ya obtenido desde la API con el token del taller) abona la cotización. */
export function evaluateSellerPayment(payment: PaymentLike, cot: CotizacionLike, workspaceCurrency: string): PaymentDecision {
  if (payment.external_reference !== cot.id) return { action: "ignorar", reason: "external_reference no coincide" };
  if (payment.status !== "approved") return { action: "ignorar", reason: `pago ${payment.status}` };
  if (cot.estado === "abonada") return { action: "ignorar", reason: "ya abonada" };
  if (cot.estado !== "enviada") return { action: "ignorar", reason: `cotización ${cot.estado}` };
  if (payment.currency_id !== workspaceCurrency) return { action: "ignorar", reason: "moneda distinta" };
  if (payment.transaction_amount + 0.005 < cot.abono_requerido) return { action: "ignorar", reason: "monto menor al abono" };
  return { action: "abonar" };
}
