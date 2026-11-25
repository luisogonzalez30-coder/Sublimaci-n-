export const digitsOnly = (s: string) => s.replace(/\D/g, "");

export function waLink(phone: string, text: string): string {
  return `https://wa.me/${digitsOnly(phone)}?text=${encodeURIComponent(text)}`;
}

export function quoteMessage(p: { cliente: string; taller: string; total: string; abono: string; abonoPct: number; link: string }): string {
  return (
    `Hola ${p.cliente} 👋 Soy de ${p.taller}. Te envío tu cotización por ${p.total}.\n` +
    `Para reservar tu pedido, el abono del ${p.abonoPct}% es ${p.abono}.\n` +
    `Míralo y págalo aquí: ${p.link}`
  );
}
