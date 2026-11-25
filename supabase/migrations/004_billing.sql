-- 004 — Eventos de facturación idempotentes (webhook de suscripciones de Mercado Pago).
-- Solo service_role (servidor) puede escribir. Ningún cliente accede a esta tabla.

create table public.billing_webhook_events (
  id             uuid primary key default gen_random_uuid(),
  provider       text not null default 'mercadopago',
  event_key      text not null,
  tipo           text,
  preapproval_id text,
  workspace_id   uuid, -- sin FK: es un log de eventos, puede referir workspaces borrados/inexistentes
  mp_status      text,
  resultado      text,
  payload        jsonb,
  received_at    timestamptz not null default now(),
  unique (provider, event_key)
);
create index billing_webhook_events_workspace_idx on public.billing_webhook_events (workspace_id);

alter table public.billing_webhook_events enable row level security; -- sin políticas = sin acceso para clientes
revoke all on public.billing_webhook_events from anon, authenticated;

-- Registra el evento (dedup por event_key) y aplica el estado de la suscripción UNA sola vez.
-- Estado MP → workspaces.subscription_status: authorized→active, paused→past_due, cancelled→cancelled,
-- pending/otros → sin cambio.
create or replace function public.procesar_evento_billing(
  p_event_key text, p_preapproval_id text, p_workspace_id uuid, p_mp_status text,
  p_tipo text default null, p_payload jsonb default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event uuid;
  v_status text;
begin
  insert into public.billing_webhook_events (event_key, tipo, preapproval_id, workspace_id, mp_status, payload)
  values (p_event_key, p_tipo, p_preapproval_id, p_workspace_id, p_mp_status, p_payload)
  on conflict (provider, event_key) do nothing
  returning id into v_event;

  if v_event is null then
    return 'duplicado';
  end if;

  v_status := case p_mp_status
    when 'authorized' then 'active'
    when 'paused'     then 'past_due'
    when 'cancelled'  then 'cancelled'
    else null end;

  update public.workspaces
     set mp_preapproval_id   = coalesce(p_preapproval_id, mp_preapproval_id),
         subscription_status = coalesce(v_status, subscription_status)
   where id = p_workspace_id;

  if not found then
    update public.billing_webhook_events set resultado = 'workspace_no_encontrado' where id = v_event;
    return 'workspace_no_encontrado';
  end if;

  update public.billing_webhook_events set resultado = 'aplicado' where id = v_event;
  return 'aplicado';
end $$;
revoke all on function public.procesar_evento_billing(text, text, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.procesar_evento_billing(text, text, uuid, text, text, jsonb) to service_role;
