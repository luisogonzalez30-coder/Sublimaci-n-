-- 002 — Cotizaciones (con vista pública segura), flag de Mercado Pago conectado y cuota diaria de IA.

-- Flag legible por el cliente: el token en sí sigue sin ser legible (ver 001).
alter table public.workspaces
  add column mp_conectado boolean generated always as (mp_seller_access_token is not null) stored;
grant select (mp_conectado) on public.workspaces to authenticated;

create table public.cotizaciones (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces (id) on delete cascade,
  cliente_nombre        text not null check (length(btrim(cliente_nombre)) > 0),
  cliente_whatsapp      text not null default '',
  items                 jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  total                 numeric(12,2) not null check (total >= 0),
  abono_porcentaje      numeric(5,2)  not null default 50 check (abono_porcentaje > 0 and abono_porcentaje <= 100),
  abono_requerido       numeric(12,2) not null check (abono_requerido >= 0),
  plazo_entrega_dias    int not null default 7 check (plazo_entrega_dias >= 0),
  notas_personalizacion text,
  estado                text not null default 'enviada'
                          check (estado in ('borrador','enviada','abonada','cancelada')),
  slug_publico          text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at            timestamptz not null default now(),
  check (abono_requerido <= total)
);
create index cotizaciones_workspace_id_idx on public.cotizaciones (workspace_id, created_at desc);

-- Privilegios: el slug lo genera siempre la BD (no adivinable) y total/items son inmutables.
revoke all on public.cotizaciones from anon, authenticated;
grant select, delete on public.cotizaciones to authenticated;
grant insert (workspace_id, cliente_nombre, cliente_whatsapp, items, total, abono_porcentaje,
              abono_requerido, plazo_entrega_dias, notas_personalizacion, estado)
  on public.cotizaciones to authenticated;
grant update (cliente_nombre, cliente_whatsapp, plazo_entrega_dias, notas_personalizacion, estado)
  on public.cotizaciones to authenticated;

alter table public.cotizaciones enable row level security;

create policy cotizaciones_select on public.cotizaciones for select to authenticated
  using (workspace_id in (select id from public.workspaces where owner_id = (select auth.uid())));
create policy cotizaciones_insert on public.cotizaciones for insert to authenticated
  with check (workspace_id in (select id from public.workspaces where owner_id = (select auth.uid())));
create policy cotizaciones_update on public.cotizaciones for update to authenticated
  using (workspace_id in (select id from public.workspaces where owner_id = (select auth.uid())))
  with check (workspace_id in (select id from public.workspaces where owner_id = (select auth.uid())));
create policy cotizaciones_delete on public.cotizaciones for delete to authenticated
  using (workspace_id in (select id from public.workspaces where owner_id = (select auth.uid())));

-- Vista pública: filtra por slug EXACTO y devuelve solo campos aptos para el cliente final.
-- Nunca expone tokens, cliente_whatsapp, ids internos ni workspace_id.
create or replace function public.cotizacion_publica(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'slug', c.slug_publico,
    'cliente_nombre', c.cliente_nombre,
    'items', c.items,
    'total', c.total,
    'abono_porcentaje', c.abono_porcentaje,
    'abono_requerido', c.abono_requerido,
    'plazo_entrega_dias', c.plazo_entrega_dias,
    'notas_personalizacion', c.notas_personalizacion,
    'estado', c.estado,
    'created_at', c.created_at,
    'taller', jsonb_build_object(
      'nombre_taller', w.nombre_taller,
      'whatsapp', w.whatsapp,
      'country_code', w.country_code,
      'currency_code', w.currency_code,
      'mp_conectado', w.mp_conectado
    )
  )
  from public.cotizaciones c
  join public.workspaces w on w.id = c.workspace_id
  where c.slug_publico = p_slug and c.estado <> 'borrador';
$$;
revoke all on function public.cotizacion_publica(text) from public;
grant execute on function public.cotizacion_publica(text) to anon, authenticated;

-- Cuota diaria del asistente IA (20 mensajes por workspace y día UTC).
create table public.ai_uso_diario (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  dia          date not null default current_date,
  mensajes     int  not null default 0 check (mensajes >= 0),
  primary key (workspace_id, dia)
);
revoke all on public.ai_uso_diario from anon, authenticated;
grant select on public.ai_uso_diario to authenticated;
alter table public.ai_uso_diario enable row level security;
create policy ai_uso_select on public.ai_uso_diario for select to authenticated
  using (workspace_id in (select id from public.workspaces where owner_id = (select auth.uid())));

-- Consume 1 mensaje de forma atómica. Devuelve los restantes (0..19) o -1 si ya llegó al límite.
create or replace function public.consumir_mensaje_ia()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  c_limite constant int := 20;
  v_ws uuid;
  v_n  int;
begin
  select id into v_ws from public.workspaces where owner_id = (select auth.uid());
  if v_ws is null then raise exception 'WORKSPACE_NO_ENCONTRADO'; end if;
  insert into public.ai_uso_diario as u (workspace_id, dia, mensajes)
  values (v_ws, current_date, 1)
  on conflict (workspace_id, dia) do update set mensajes = u.mensajes + 1
    where u.mensajes < c_limite
  returning u.mensajes into v_n;
  if v_n is null then return -1; end if;
  return c_limite - v_n;
end $$;
revoke all on function public.consumir_mensaje_ia() from public, anon;
grant execute on function public.consumir_mensaje_ia() to authenticated;
