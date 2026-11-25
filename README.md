# Taller Costeo (Micro-SaaS B2B)

Reglas de arquitectura y negocio: ver [`CLAUDE.md`](./CLAUDE.md).

## Desarrollo

```bash
cp .env.example .env.local   # completar URL y anon key de Supabase
npm install
npm run dev
```

## Base de datos

Aplicar `supabase/migrations/001_core_schema.sql` (SQL Editor de Supabase o `supabase db push`).
En Supabase Auth, definir Site URL y Redirect URL `https://<dominio>/auth/callback`.

## Checks

```bash
npm run typecheck && npm test && npm run build
```

`npm test` incluye tests del motor de costeo y pruebas del esquema/RLS/triggers contra Postgres real (PGlite).
