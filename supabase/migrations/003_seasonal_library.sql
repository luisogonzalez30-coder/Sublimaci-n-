-- 003 — Biblioteca de Temporadas: plantillas globales + importación atómica en 1 clic.
-- Costos base en "unidades de referencia" escaladas por `factores_pais` (nivel de precios por país).
-- Son valores referenciales editables por el taller; no son tipos de cambio.

create table public.plantillas_temporada (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  nombre          text not null,
  descripcion     text not null default '',
  emoji           text not null default '🎁',
  publicar_desde  date,
  publicar_hasta  date,
  solo_pro        boolean not null default false,
  activa          boolean not null default true,
  factores_pais   jsonb not null default '{"CL":1,"MX":0.0233,"CO":4,"AR":2.33,"PE":0.0053}'::jsonb,
  contenido       jsonb not null,
  created_at      timestamptz not null default now(),
  check (publicar_hasta is null or publicar_desde is null or publicar_hasta >= publicar_desde)
);

alter table public.plantillas_temporada enable row level security;
revoke all on public.plantillas_temporada from anon, authenticated;
grant select on public.plantillas_temporada to authenticated;
create policy plantillas_select on public.plantillas_temporada for select to authenticated using (activa);

insert into public.plantillas_temporada (slug, nombre, descripcion, emoji, publicar_desde, publicar_hasta, solo_pro, contenido) values
('dia-de-la-madre', 'Día de la Madre', 'Tazones, packs y cajas de regalo para mamá.', '💐', '2027-04-01', '2027-05-16', false,
 $j${"insumos":[
   {"key":"tazon","nombre":"Tazón blanco 11oz","categoria":"blanco","unidad_medida":"unidad","costo_base":1500},
   {"key":"caja","nombre":"Caja individual","categoria":"empaque","unidad_medida":"unidad","costo_base":450},
   {"key":"papel","nombre":"Papel sublimación (hoja A4)","categoria":"tinta_papel","unidad_medida":"hoja","costo_base":250},
   {"key":"lazo","nombre":"Lazo y tarjeta de regalo","categoria":"empaque","unidad_medida":"unidad","costo_base":200}],
 "productos":[
   {"nombre":"Tazón Mamá personalizado","merma_pct":10,"mano_obra_base":1200,"gastos_base":300,"margen_objetivo_pct":50,"aplica_iva":false,
    "receta":[{"insumo":"tazon","cantidad":1},{"insumo":"caja","cantidad":1},{"insumo":"papel","cantidad":0.5},{"insumo":"lazo","cantidad":1}]},
   {"nombre":"Pack Mamá (2 tazones + caja)","merma_pct":10,"mano_obra_base":2000,"gastos_base":500,"margen_objetivo_pct":50,"aplica_iva":false,
    "receta":[{"insumo":"tazon","cantidad":2},{"insumo":"caja","cantidad":1},{"insumo":"papel","cantidad":1},{"insumo":"lazo","cantidad":1}]}]}$j$::jsonb),
('egresos-escolares', 'Egresos Escolares', 'Poleras y tazones para generaciones y fiestas de graduación.', '🎓', '2026-10-01', '2026-12-31', false,
 $j${"insumos":[
   {"key":"polera","nombre":"Polera blanca poliéster","categoria":"blanco","unidad_medida":"unidad","costo_base":3500},
   {"key":"dtf","nombre":"Metro lineal DTF 60cm (costo por cm)","categoria":"estampado","unidad_medida":"cm","costo_base":90},
   {"key":"bolsa","nombre":"Bolsa individual","categoria":"empaque","unidad_medida":"unidad","costo_base":150}],
 "productos":[
   {"nombre":"Polera egresados DTF","merma_pct":8,"mano_obra_base":1500,"gastos_base":300,"margen_objetivo_pct":45,"aplica_iva":false,
    "receta":[{"insumo":"polera","cantidad":1},{"insumo":"dtf","cantidad":30},{"insumo":"bolsa","cantidad":1}]},
   {"nombre":"Polera generación (logo pequeño)","merma_pct":8,"mano_obra_base":1200,"gastos_base":300,"margen_objetivo_pct":45,"aplica_iva":false,
    "receta":[{"insumo":"polera","cantidad":1},{"insumo":"dtf","cantidad":12},{"insumo":"bolsa","cantidad":1}]}]}$j$::jsonb),
('corporativo-pyme', 'Corporativo Pyme', 'Kits de merchandising con logo para empresas y emprendimientos.', '🏢', null, null, true,
 $j${"insumos":[
   {"key":"tazon","nombre":"Tazón blanco 11oz","categoria":"blanco","unidad_medida":"unidad","costo_base":1500},
   {"key":"polera","nombre":"Polera blanca poliéster","categoria":"blanco","unidad_medida":"unidad","costo_base":3500},
   {"key":"dtf","nombre":"Metro lineal DTF 60cm (costo por cm)","categoria":"estampado","unidad_medida":"cm","costo_base":90},
   {"key":"caja","nombre":"Caja individual","categoria":"empaque","unidad_medida":"unidad","costo_base":450}],
 "productos":[
   {"nombre":"Tazón corporativo con logo","merma_pct":8,"mano_obra_base":900,"gastos_base":250,"margen_objetivo_pct":45,"aplica_iva":true,
    "receta":[{"insumo":"tazon","cantidad":1},{"insumo":"caja","cantidad":1}]},
   {"nombre":"Kit bienvenida (tazón + polera)","merma_pct":8,"mano_obra_base":2200,"gastos_base":500,"margen_objetivo_pct":45,"aplica_iva":true,
    "receta":[{"insumo":"tazon","cantidad":1},{"insumo":"polera","cantidad":1},{"insumo":"dtf","cantidad":20},{"insumo":"caja","cantidad":1}]}]}$j$::jsonb),
('navidad', 'Navidad', 'Regalos personalizados de fin de año: tazones, packs y cajas.', '🎄', '2026-10-15', '2026-12-24', false,
 $j${"insumos":[
   {"key":"tazon","nombre":"Tazón blanco 11oz","categoria":"blanco","unidad_medida":"unidad","costo_base":1500},
   {"key":"caja","nombre":"Caja individual","categoria":"empaque","unidad_medida":"unidad","costo_base":450},
   {"key":"papel","nombre":"Papel sublimación (hoja A4)","categoria":"tinta_papel","unidad_medida":"hoja","costo_base":250},
   {"key":"papelregalo","nombre":"Papel de regalo navideño","categoria":"empaque","unidad_medida":"unidad","costo_base":180}],
 "productos":[
   {"nombre":"Tazón navideño personalizado","merma_pct":10,"mano_obra_base":1100,"gastos_base":300,"margen_objetivo_pct":50,"aplica_iva":false,
    "receta":[{"insumo":"tazon","cantidad":1},{"insumo":"caja","cantidad":1},{"insumo":"papel","cantidad":0.5},{"insumo":"papelregalo","cantidad":1}]},
   {"nombre":"Pack Navidad familiar (4 tazones)","merma_pct":10,"mano_obra_base":3000,"gastos_base":700,"margen_objetivo_pct":48,"aplica_iva":false,
    "receta":[{"insumo":"tazon","cantidad":4},{"insumo":"caja","cantidad":2},{"insumo":"papel","cantidad":2},{"insumo":"papelregalo","cantidad":2}]}]}$j$::jsonb);

-- Importar y costear en 1 clic (atómico). SECURITY DEFINER porque escribe biblioteca_imports_usados,
-- columna que el cliente no puede modificar. Deriva el workspace de auth.uid().
-- Trial: máximo 1 importación y sin packs solo_pro. Suscripción activa: ilimitado.
create or replace function public.importar_plantilla(p_plantilla_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws       public.workspaces%rowtype;
  v_tpl      public.plantillas_temporada%rowtype;
  v_activo   boolean;
  v_factor   numeric;
  v_ins      jsonb;
  v_prod     jsonb;
  v_linea    jsonb;
  v_map      jsonb := '{}'::jsonb;
  v_id       uuid;
  v_pid      uuid;
  v_nombre   text;
  v_n        int;
  v_ins_new  int := 0;
  v_prod_new int := 0;
begin
  select * into v_ws from public.workspaces where owner_id = (select auth.uid()) for update;
  if not found then raise exception 'WORKSPACE_NO_ENCONTRADO'; end if;

  v_activo := v_ws.subscription_status = 'active';
  if not v_activo and now() >= v_ws.trial_ends_at then raise exception 'TRIAL_VENCIDO'; end if;

  select * into v_tpl from public.plantillas_temporada
   where id = p_plantilla_id and activa
     and (publicar_desde is null or current_date >= publicar_desde)
     and (publicar_hasta is null or current_date <= publicar_hasta);
  if not found then raise exception 'BIBLIOTECA_NO_DISPONIBLE'; end if;

  if v_tpl.solo_pro and not v_activo then raise exception 'BIBLIOTECA_SOLO_PRO'; end if;
  if not v_activo and v_ws.biblioteca_imports_usados >= 1 then raise exception 'BIBLIOTECA_LIMITE_TRIAL'; end if;

  v_factor := coalesce((v_tpl.factores_pais ->> v_ws.country_code)::numeric, 1);

  for v_ins in select e from jsonb_array_elements(v_tpl.contenido -> 'insumos') e loop
    select id into v_id from public.insumos
     where workspace_id = v_ws.id and lower(nombre) = lower(v_ins ->> 'nombre') limit 1;
    if v_id is null then
      insert into public.insumos (workspace_id, nombre, categoria, unidad_medida, costo_unitario)
      values (v_ws.id, v_ins ->> 'nombre', v_ins ->> 'categoria', v_ins ->> 'unidad_medida',
              round((v_ins ->> 'costo_base')::numeric * v_factor, 4))
      returning id into v_id;
      v_ins_new := v_ins_new + 1;
    end if;
    v_map := v_map || jsonb_build_object(v_ins ->> 'key', v_id);
  end loop;

  for v_prod in select e from jsonb_array_elements(v_tpl.contenido -> 'productos') e loop
    v_nombre := v_prod ->> 'nombre';
    v_n := 0;
    while exists (select 1 from public.productos where workspace_id = v_ws.id and lower(nombre) = lower(v_nombre)) loop
      v_n := v_n + 1;
      v_nombre := (v_prod ->> 'nombre') || case when v_n = 1 then ' (biblioteca)' else ' (biblioteca ' || v_n || ')' end;
    end loop;
    insert into public.productos (workspace_id, nombre, merma_pct, mano_obra_fija, gastos_fijos_prorrateo,
                                  margen_objetivo_pct, aplica_iva)
    values (v_ws.id, v_nombre, (v_prod ->> 'merma_pct')::numeric,
            round((v_prod ->> 'mano_obra_base')::numeric * v_factor, 2),
            round((v_prod ->> 'gastos_base')::numeric * v_factor, 2),
            (v_prod ->> 'margen_objetivo_pct')::numeric, (v_prod ->> 'aplica_iva')::boolean)
    returning id into v_pid;
    v_prod_new := v_prod_new + 1;

    for v_linea in select e from jsonb_array_elements(v_prod -> 'receta') e loop
      insert into public.producto_insumos (producto_id, insumo_id, cantidad_requerida)
      values (v_pid, (v_map ->> (v_linea ->> 'insumo'))::uuid, (v_linea ->> 'cantidad')::numeric);
    end loop;
  end loop;

  update public.workspaces set biblioteca_imports_usados = biblioteca_imports_usados + 1 where id = v_ws.id;

  return jsonb_build_object('plantilla', v_tpl.nombre, 'insumos_creados', v_ins_new, 'productos_creados', v_prod_new);
end $$;
revoke all on function public.importar_plantilla(uuid) from public, anon;
grant execute on function public.importar_plantilla(uuid) to authenticated;
