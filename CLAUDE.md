# CLAUDE.md — Micro-SaaS B2B para talleres de Sublimación, DTF y Regalos Personalizados

Micro-SaaS vertical para talleres de sublimación, estampado DTF y regalos personalizados en LATAM. La arquitectura debe ser replicable a otros oficios (cambiar catálogo/plantillas, no el core).

---

## 1. Stack técnico

| Capa | Tecnología | Reglas |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript (strict) + Tailwind CSS | PWA mobile-first: `app/manifest.ts`, íconos (192/512/maskable), `viewport` móvil en `layout.tsx`. |
| DB + Auth | Supabase: `@supabase/supabase-js` + `@supabase/ssr` | Cliente separado por contexto (ver abajo). Cookies gestionadas vía `@supabase/ssr`. |
| Pagos | API REST de Mercado Pago | Suscripción SaaS: `https://api.mercadopago.com/preapproval`. Abonos de clientes del taller: Checkout Pro. |
| IA | Gemini 2.5 Flash vía `@google/genai` | Respuestas breves, accionables, `maxOutputTokens` acotado. |

### Clientes Supabase (un helper por contexto)

- `lib/supabase/client.ts` → `createBrowserClient` (solo Client Components, solo `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- `lib/supabase/server.ts` → `createServerClient` con `cookies()` de `next/headers` (Server Components, Server Actions, Route Handlers; `setAll` en try/catch en Server Components).
- `middleware.ts` → refresca sesión con `createServerClient` sobre `NextRequest/NextResponse`.
- `lib/supabase/admin.ts` → `service_role`, marcado `import 'server-only'`. Solo para webhooks y jobs.

### Estructura modular (SOLID)

- `app/` → rutas, layouts, Server Actions (finas: validan, delegan, responden).
- `lib/domain/` → lógica de negocio pura (cálculo de precios, impuestos, abonos). Sin I/O, 100 % testeable.
- `lib/services/` → integraciones (MercadoPago, Gemini, Supabase repos) detrás de interfaces; inyectables.
- `lib/money/` → única fuente de formateo y cálculo monetario.
- Validación de entrada con Zod en cada Server Action / Route Handler.

---

## 2. Reglas de negocio inquebrantables

### 2.1 Multi-país desde el día 1

- **Prohibido hardcodear** `"CLP"`, `"$"`, `19` / `0.19` / `"19%"` o cualquier moneda/impuesto/país.
- Leer siempre desde `workspaces`: `country_code`, `currency_code`, `tax_rate_pct`.
- Formato monetario: `Intl.NumberFormat(locale, { style: 'currency', currency: workspace.currency_code })`. Decimales según la moneda (CLP = 0).
- Cálculo de impuestos con `tax_rate_pct` del workspace; aritmética en enteros (unidad menor) o `decimal`, nunca floats acumulados.

### 2.2 Cero comisión por venta del cliente

- El SaaS cobra **suscripción fija mensual** (~$9.990 CLP / $10 USD). Ningún % sobre ventas del taller.
- **Nunca intermediar fondos** del cliente final del taller: sin `marketplace_fee`, sin `application_fee`, sin cuenta puente.
- Cada taller conecta su **propio** token/credencial de Mercado Pago (OAuth o access token propio) y cobra sus abonos por Checkout Pro directo a su cuenta. Credenciales del taller cifradas, solo server-side.

### 2.3 Trial interno de 5 días sin tarjeta

- El registro **NO pide tarjeta**.
- Expiración controlada por `workspaces.trial_ends_at` (= `created_at + 5 días`). Estado de acceso derivado de `trial_ends_at` + estado de suscripción.
- El plan de `preapproval` en Mercado Pago se configura **SIN período de prueba gratis** (`free_trial` ausente): cobra de inmediato cuando el usuario activa su plan en el **Paywall**.
- Trial vencido y sin suscripción activa → redirigir al Paywall (verificación en middleware y en Server Actions críticas, no solo en UI).
- Webhooks de Mercado Pago: validar firma, idempotentes, actualizan el estado de suscripción del workspace.

### 2.4 Seguridad estricta

- **RLS habilitado en todas las tablas de dominio**, filtrando por `workspace_id` perteneciente a `auth.uid()` (vía `workspace_members` o `workspaces.owner_id`). Sin política = sin acceso.
- Toda migración que cree una tabla incluye en el mismo archivo: `ENABLE ROW LEVEL SECURITY` + políticas `select/insert/update/delete` + índice por `workspace_id`.
- `SUPABASE_SERVICE_ROLE_KEY` **jamás** en el cliente: sin prefijo `NEXT_PUBLIC_`, solo en módulos `server-only`.
- Secretos (Mercado Pago, Gemini) solo server-side. Nunca loguear tokens ni PII.
- Migraciones SQL versionadas en `supabase/migrations/`; tipos generados con `supabase gen types`.

---

## 3. Estándar de entrega por PR

Antes de dar por cerrado cada PR:

1. `npm run typecheck`
2. `npm run build`
3. Pruebas unitarias de cálculo (precios, impuestos, abonos, trial, formateo multi-moneda) — `npm test`
4. Corregir **todo** error antes de cerrar el paso. No se entrega con checks en rojo ni se omiten tests para pasar.

Scripts mínimos requeridos en `package.json`: `typecheck` (`tsc --noEmit`), `build`, `test`, `lint`.

### Checklist rápido de PR

- [ ] Sin `CLP`/`$`/`19%` hardcodeados
- [ ] Tablas nuevas con RLS + políticas por `workspace_id`
- [ ] Ninguna clave privada expuesta al cliente
- [ ] Sin comisión ni intermediación de fondos del taller
- [ ] `typecheck` + `build` + tests de cálculo en verde
