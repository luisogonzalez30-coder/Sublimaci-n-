-- 001a — RPC atómica: guarda/actualiza un producto y su receta en UNA transacción.
-- SECURITY INVOKER: RLS de 001 sigue aplicando (workspace y pertenencia de insumos).
-- Cualquier error (insumo ajeno, cantidad <= 0, margen >= 100…) revierte todo.

create or replace function public.upsert_producto_con_insumos(p_producto jsonb, p_items jsonb default '[]'::jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_ws    uuid;
  v_id    uuid := nullif(p_producto ->> 'id', '')::uuid;
  v_items jsonb := coalesce(p_items, '[]'::jsonb);
begin
  select id into v_ws from public.workspaces where owner_id = (select auth.uid());
  if v_ws is null then
    raise exception 'WORKSPACE_NO_ENCONTRADO';
  end if;
  if jsonb_typeof(v_items) <> 'array' then
    raise exception 'ITEMS_INVALIDOS';
  end if;

  if v_id is null then
    insert into public.productos (workspace_id, nombre, merma_pct, mano_obra_fija,
                                  gastos_fijos_prorrateo, margen_objetivo_pct, aplica_iva)
    values (
      v_ws,
      p_producto ->> 'nombre',
      coalesce((p_producto ->> 'merma_pct')::numeric, 10),
      coalesce((p_producto ->> 'mano_obra_fija')::numeric, 0),
      coalesce((p_producto ->> 'gastos_fijos_prorrateo')::numeric, 0),
      coalesce((p_producto ->> 'margen_objetivo_pct')::numeric, 45),
      coalesce((p_producto ->> 'aplica_iva')::boolean, false)
    )
    returning id into v_id;
  else
    update public.productos set
      nombre                 = coalesce(p_producto ->> 'nombre', nombre),
      merma_pct              = coalesce((p_producto ->> 'merma_pct')::numeric, merma_pct),
      mano_obra_fija         = coalesce((p_producto ->> 'mano_obra_fija')::numeric, mano_obra_fija),
      gastos_fijos_prorrateo = coalesce((p_producto ->> 'gastos_fijos_prorrateo')::numeric, gastos_fijos_prorrateo),
      margen_objetivo_pct    = coalesce((p_producto ->> 'margen_objetivo_pct')::numeric, margen_objetivo_pct),
      aplica_iva             = coalesce((p_producto ->> 'aplica_iva')::boolean, aplica_iva)
    where id = v_id and workspace_id = v_ws;
    if not found then
      raise exception 'PRODUCTO_NO_ENCONTRADO';
    end if;
    delete from public.producto_insumos where producto_id = v_id;
  end if;

  insert into public.producto_insumos (producto_id, insumo_id, cantidad_requerida)
  select v_id, (i ->> 'insumo_id')::uuid, (i ->> 'cantidad_requerida')::numeric
  from jsonb_array_elements(v_items) as i;

  return v_id;
end $$;

revoke all on function public.upsert_producto_con_insumos(jsonb, jsonb) from public, anon;
grant execute on function public.upsert_producto_con_insumos(jsonb, jsonb) to authenticated;
