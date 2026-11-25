-- 001_core_schema.sql — esquema núcleo, RLS y recálculo automático de precios.
-- Reglas: ver CLAUDE.md (multi-país desde workspaces, RLS por workspace_id, sin service_role en cliente).


-- ───────────────────────────── Tablas ─────────────────────────────

create table public.workspaces (
  id                        uuid primary key default gen_random_uuid(),
  owner_id                  uuid not null unique references auth.users (id) on delete cascade,
  nombre_taller             text not null check (length(btrim(nombre_taller)) > 0),
  whatsapp                  text not null,
  country_code              text not null default 'CL' check (country_code ~ '^[A-Z]{2}$'),
  currency_code             text not null default 'CLP' check (currency_code ~ '^[A-Z]{3}$'),
  tax_rate_pct              numeric(5,2) not null default 19.00 check (tax_rate_pct >= 0 and tax_rate_pct < 100),
  trial_ends_at             timestamptz not null default (now() + interval '5 days'),
  subscription_status       text not null default 'trialing'
                              check (subscription_status in ('trialing','active','past_due','cancelled','expired')),
  mp_preapproval_id         text,
  mp_seller_access_token    text,
  biblioteca_imports_usados int not null default 0 check (biblioteca_imports_usados >= 0),
  created_at                timestamptz not null default now()
);

create table public.insumos (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  nombre         text not null check (length(btrim(nombre)) > 0),
  categoria      text not null default 'otro'
                   check (categoria in ('blanco','estampado','tinta_papel','empaque','otro')),
  unidad_medida  text not null default 'unidad'
                   check (unidad_medida in ('unidad','cm','ml','hoja','minuto')),
  costo_unitario numeric(12,4) not null default 0 check (costo_unitario >= 0),
  stock_actual   numeric(12,2) not null default 0,
  updated_at     timestamptz not null default now()
);

create table public.productos (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid not null references public.workspaces (id) on delete cascade,
  nombre                 text not null check (length(btrim(nombre)) > 0),
  merma_pct              numeric(5,2)  not null default 10.00 check (merma_pct >= 0),
  mano_obra_fija         numeric(12,2) not null default 0 check (mano_obra_fija >= 0),
  gastos_fijos_prorrateo numeric(12,2) not null default 0 check (gastos_fijos_prorrateo >= 0),
  margen_objetivo_pct    numeric(5,2)  not null default 45.00
                           check (margen_objetivo_pct >= 0 and margen_objetivo_pct < 100),
  aplica_iva             boolean       not null default false,
  precio_sugerido        numeric(12,2),
  created_at             timestamptz   not null default now()
);

create table public.producto_insumos (
  id                 uuid primary key default gen_random_uuid(),
  producto_id        uuid not null references public.productos (id) on delete cascade,
  insumo_id          uuid not null references public.insumos (id) on delete restrict,
  cantidad_requerida numeric(12,4) not null check (cantidad_requerida > 0),
  unique (producto_id, insumo_id)
);

create index insumos_workspace_id_idx          on public.insumos (workspace_id);
create index productos_workspace_id_idx        on public.productos (workspace_id);
create index producto_insumos_producto_id_idx  on public.producto_insumos (producto_id);
create index producto_insumos_insumo_id_idx    on public.producto_insumos (insumo_id);

-- ───────────────────── Privilegios (columnas sensibles) ─────────────────────
-- Un cliente con la anon key no debe poder alargar su trial, cambiar su estado de
-- suscripción ni leer el token de Mercado Pago. Esas columnas solo las escribe/lee
-- el servidor con service_role (webhooks, Server Actions con cliente admin).

revoke all on public.workspaces        from anon, authenticated;
revoke all on public.insumos           from anon;
revoke all on public.productos         from anon;
revoke all on public.producto_insumos  from anon;

grant select (id, owner_id, nombre_taller, whatsapp, country_code, currency_code, tax_rate_pct,
              trial_ends_at, subscription_status, mp_preapproval_id, biblioteca_imports_usados, created_at)
  on public.workspaces to authenticated;
grant insert (owner_id, nombre_taller, whatsapp, country_code, currency_code, tax_rate_pct)
  on public.workspaces to authenticated;
grant update (nombre_taller, whatsapp, country_code, currency_code, tax_rate_pct)
  on public.workspaces to authenticated;

grant select, insert, update, delete on public.insumos          to authenticated;
grant select, insert, update, delete on public.productos        to authenticated;
grant select, insert, update, delete on public.producto_insumos to authenticated;

-- ───────────────────────────── RLS ─────────────────────────────

alter table public.workspaces       enable row level security;
alter table public.insumos          enable row level security;
alter table public.productos        enable row level security;
alter table public.producto_insumos enable row level security;

-- workspaces: el dueño ve/edita solo el suyo.
create policy workspaces_select on public.workspaces for select to authenticated
  using (owner_id = (select auth.uid()));
create policy workspaces_insert on public.workspaces for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy workspaces_update on public.workspaces for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy workspaces_delete on public.workspaces for delete to authenticated
  using (owner_id = (select auth.uid()));

-- insumos / productos: workspace_id debe pertenecer a owner_id = auth.uid().
create policy insumos_select on public.insumos for select to authenticated
  using (workspace_id in (select id from public.workspaces where owner_id = (select auth.uid())));
create policy insumos_insert on public.insumos for insert to authenticated
  with check (workspace_id in (select id from public.workspaces where owner_id = (select auth.uid())));
create policy insumos_update on public.insumos for update to authenticated
  using (workspace_id in (select id from public.workspaces where owner_id = (select auth.uid())))
  with check (workspace_id in (select id from public.workspaces where owner_id = (select auth.uid())));
create policy insumos_delete on public.insumos for delete to authenticated
  using (workspace_id in (select id from public.workspaces where owner_id = (select auth.uid())));

create policy productos_select on public.productos for select to authenticated
  using (workspace_id in (select id from public.workspaces where owner_id = (select auth.uid())));
create policy productos_insert on public.productos for insert to authenticated
  with check (workspace_id in (select id from public.workspaces where owner_id = (select auth.uid())));
create policy productos_update on public.productos for update to authenticated
  using (workspace_id in (select id from public.workspaces where owner_id = (select auth.uid())))
  with check (workspace_id in (select id from public.workspaces where owner_id = (select auth.uid())));
create policy productos_delete on public.productos for delete to authenticated
  using (workspace_id in (select id from public.workspaces where owner_id = (select auth.uid())));

-- producto_insumos: hereda el workspace de productos; además el insumo debe ser del mismo dueño.
create policy producto_insumos_select on public.producto_insumos for select to authenticated
  using (producto_id in (
    select p.id from public.productos p
    join public.workspaces w on w.id = p.workspace_id
    where w.owner_id = (select auth.uid())));
create policy producto_insumos_insert on public.producto_insumos for insert to authenticated
  with check (
    producto_id in (select p.id from public.productos p join public.workspaces w on w.id = p.workspace_id
                    where w.owner_id = (select auth.uid()))
    and insumo_id in (select i.id from public.insumos i join public.workspaces w on w.id = i.workspace_id
                      where w.owner_id = (select auth.uid())));
create policy producto_insumos_update on public.producto_insumos for update to authenticated
  using (producto_id in (select p.id from public.productos p join public.workspaces w on w.id = p.workspace_id
                         where w.owner_id = (select auth.uid())))
  with check (
    producto_id in (select p.id from public.productos p join public.workspaces w on w.id = p.workspace_id
                    where w.owner_id = (select auth.uid()))
    and insumo_id in (select i.id from public.insumos i join public.workspaces w on w.id = i.workspace_id
                      where w.owner_id = (select auth.uid())));
create policy producto_insumos_delete on public.producto_insumos for delete to authenticated
  using (producto_id in (select p.id from public.productos p join public.workspaces w on w.id = p.workspace_id
                         where w.owner_id = (select auth.uid())));

-- ───────────────── Motor de precio en SQL (espejo de lib/pricing/calculator.ts) ─────────────────
-- precio_sugerido = precio final (con impuesto del workspace si aplica_iva) para 1 unidad.

create or replace function public.calcular_precio_sugerido(p_producto_id uuid)
returns numeric
language sql
stable
set search_path = public
as $$
  select case
    when p.margen_objetivo_pct >= 100 then null
    else round(
      (
        (coalesce(sum(pi.cantidad_requerida * i.costo_unitario), 0) * (1 + p.merma_pct / 100)
          + p.mano_obra_fija + p.gastos_fijos_prorrateo)
        / (1 - p.margen_objetivo_pct / 100)
        * case when p.aplica_iva then 1 + w.tax_rate_pct / 100 else 1 end
      ),
      2)
  end
  from public.productos p
  join public.workspaces w on w.id = p.workspace_id
  left join public.producto_insumos pi on pi.producto_id = p.id
  left join public.insumos i on i.id = pi.insumo_id
  where p.id = p_producto_id
  group by p.id, w.id;
$$;

create or replace function public.recalcular_productos(p_producto_ids uuid[])
returns void
language sql
set search_path = public
as $$
  update public.productos p
     set precio_sugerido = public.calcular_precio_sugerido(p.id)
   where p.id = any (p_producto_ids);
$$;

-- 1) Cambia el costo de un insumo → recalcula todos los productos que lo usan.
create or replace function public.trg_insumo_costo_recalcula()
returns trigger language plpgsql set search_path = public as $$
begin
  perform public.recalcular_productos(
    array(select producto_id from public.producto_insumos where insumo_id = new.id));
  return null;
end $$;

create trigger insumos_costo_recalcula
  after update of costo_unitario on public.insumos
  for each row when (old.costo_unitario is distinct from new.costo_unitario)
  execute function public.trg_insumo_costo_recalcula();

-- 2) Cambia la receta de un producto.
create or replace function public.trg_receta_recalcula()
returns trigger language plpgsql set search_path = public as $$
begin
  perform public.recalcular_productos(
    array[case when tg_op = 'DELETE' then old.producto_id else new.producto_id end]);
  if tg_op = 'UPDATE' and old.producto_id <> new.producto_id then
    perform public.recalcular_productos(array[old.producto_id]);
  end if;
  return null;
end $$;

create trigger producto_insumos_recalcula
  after insert or update or delete on public.producto_insumos
  for each row execute function public.trg_receta_recalcula();

-- 3) Cambian los parámetros del producto (merma, mano de obra, margen, IVA...).
create or replace function public.trg_producto_recalcula()
returns trigger language plpgsql set search_path = public as $$
begin
  perform public.recalcular_productos(array[new.id]);
  return null;
end $$;

create trigger productos_recalcula_ins
  after insert on public.productos
  for each row execute function public.trg_producto_recalcula();

create trigger productos_recalcula_upd
  after update of merma_pct, mano_obra_fija, gastos_fijos_prorrateo, margen_objetivo_pct, aplica_iva
  on public.productos
  for each row execute function public.trg_producto_recalcula();

-- 4) Cambia el impuesto del workspace → recalcula sus productos con IVA.
create or replace function public.trg_workspace_tax_recalcula()
returns trigger language plpgsql set search_path = public as $$
begin
  perform public.recalcular_productos(
    array(select id from public.productos where workspace_id = new.id and aplica_iva));
  return null;
end $$;

create trigger workspaces_tax_recalcula
  after update of tax_rate_pct on public.workspaces
  for each row when (old.tax_rate_pct is distinct from new.tax_rate_pct)
  execute function public.trg_workspace_tax_recalcula();

-- updated_at de insumos.
create or replace function public.trg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger insumos_set_updated_at
  before update on public.insumos
  for each row execute function public.trg_set_updated_at();
