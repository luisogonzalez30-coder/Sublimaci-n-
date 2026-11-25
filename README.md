# Taller Costeo (Micro-SaaS B2B)

Reglas de arquitectura y negocio: ver [`CLAUDE.md`](./CLAUDE.md).

## Desarrollo

```bash
cp .env.example .env.local   # completar URL y anon key de Supabase
npm install
npm run dev
```

## Base de datos

```bash
npm run db:push   # aplica supabase/migrations/*.sql en orden (requiere SUPABASE_DB_URL en .env.local)
```

Migraciones: `001` esquema+RLS+triggers · `001a` RPC `upsert_producto_con_insumos` · `002` cotizaciones, cuota IA ·
`003` biblioteca de temporadas · `004` eventos de facturación idempotentes.
En Supabase Auth, definir Site URL y Redirect URL `https://<dominio>/auth/callback`.

## Webhooks de Mercado Pago

- Suscripciones SaaS: `POST https://<dominio>/api/webhooks/mp-billing` (evento *Planes y suscripciones*; firma con `MP_WEBHOOK_SECRET`).
- Abonos de talleres: se registra automáticamente por preferencia (`/api/webhooks/mp-seller?ws=<workspace>`).

## Checks

```bash
npm run typecheck && npm test && npm run build
```

`npm test` incluye tests del motor de costeo y pruebas del esquema/RLS/triggers contra Postgres real (PGlite).
