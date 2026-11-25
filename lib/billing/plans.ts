export interface PlanPrice {
  amount: number;
  currency_id: string;
}

/**
 * Plan fijo mensual (sin comisión por ventas del taller). Configuración de PRODUCTO, no del workspace:
 * Chile se cobra en moneda local; el resto de LATAM en USD (confirmar que tu cuenta MP acepte USD).
 */
const PLAN_BY_COUNTRY: Record<string, PlanPrice> = { CL: { amount: 9990, currency_id: "CLP" } };
const PLAN_DEFAULT: PlanPrice = { amount: 10, currency_id: "USD" };

export function planForCountry(countryCode: string): PlanPrice {
  return PLAN_BY_COUNTRY[countryCode] ?? PLAN_DEFAULT;
}

export interface PreapprovalInput {
  workspaceId: string;
  payerEmail: string;
  countryCode: string;
  baseUrl: string;
}

/** Cobro mensual inmediato: SIN `free_trial` (el trial de 5 días es interno). */
export function buildPreapprovalBody(i: PreapprovalInput) {
  const plan = planForCountry(i.countryCode);
  return {
    reason: "Suscripción mensual Taller Costeo",
    external_reference: i.workspaceId,
    payer_email: i.payerEmail,
    status: "pending" as const,
    back_url: `${i.baseUrl}/suscripcion?mp=return`,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months" as const,
      transaction_amount: plan.amount,
      currency_id: plan.currency_id,
    },
  };
}
