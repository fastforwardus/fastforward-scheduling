create table if not exists reminders (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  notes               text,
  due_at              timestamptz not null,
  original_due_at     timestamptz not null,
  snooze_count        integer not null default 0,
  created_by_user_id  uuid not null references users(id) on delete cascade,
  assigned_to_user_id uuid not null references users(id) on delete cascade,
  lead_email          text,
  lead_phone          text,
  source_type         text,
  source_id           text,
  notify_channels     text[] not null default '{app}'::text[],
  last_notified_at    timestamptz,
  done_at             timestamptz,
  done_by_user_id     uuid references users(id) on delete set null,
  created_at          timestamptz not null default now(),
  constraint reminders_channels_validos
    check (notify_channels <@ array['app','email']::text[])
);
create index if not exists idx_reminders_abiertos
  on reminders(assigned_to_user_id, due_at) where done_at is null;
create index if not exists idx_reminders_lead on reminders(lead_email);

drop view if exists v_movimientos;
create view v_movimientos as

select
  a.created_at::timestamptz                                      as occurred_at,
  'scheduling'::text                                             as source,
  'cita_agendada'::text                                          as kind,
  coalesce(u.full_name, a.booked_via)::text                      as actor,
  ('Cita agendada para ' || to_char(a.scheduled_at,'DD/MM HH24:MI'))::text as description,
  a.platform::text                                               as detail,
  lower(nullif(trim(a.client_email),''))::text                   as lead_email,
  nullif(right(regexp_replace(coalesce(a.client_whatsapp,''),'\D','','g'),10),'')::text as lead_phone,
  a.client_company::text                                         as lead_company,
  'appointment'::text                                            as src_type,
  a.id::text                                                     as src_id
from appointments a left join users u on u.id = a.assigned_to

union all
select a.scheduled_at::timestamptz, 'scheduling', 'cita',
  coalesce(u.full_name,'sin asignar')::text,
  (a.client_company || ' — ' || a.status::text)::text,
  a.outcome::text,
  lower(nullif(trim(a.client_email),''))::text,
  nullif(right(regexp_replace(coalesce(a.client_whatsapp,''),'\D','','g'),10),'')::text,
  a.client_company::text, 'appointment', a.id::text
from appointments a left join users u on u.id = a.assigned_to

union all
select m.created_at::timestamptz, 'whatsapp', 'mensaje',
  (case when m.role='user' then coalesce(c.lead_name,'cliente') else 'Adriana' end)::text,
  left(case when jsonb_typeof(m.content)='string' then m.content #>> '{}'
            else coalesce(m.content->0->>'text', m.content::text) end, 200)::text,
  null::text,
  lower(nullif(trim(c.lead_email),''))::text,
  nullif(right(regexp_replace(coalesce(c.wa_phone,''),'\D','','g'),10),'')::text,
  c.lead_company::text, 'conversation', c.id::text
from adriana_messages m join adriana_conversations c on c.id = m.conversation_id

union all
select h.created_at::timestamptz, 'whatsapp', 'pendiente', 'Adriana',
  h.summary::text, (h.reason || ' · ' || h.urgency)::text,
  lower(nullif(trim(c.lead_email),''))::text,
  nullif(right(regexp_replace(coalesce(c.wa_phone,''),'\D','','g'),10),'')::text,
  c.lead_company::text, 'handoff', h.id::text
from adriana_handoffs h join adriana_conversations c on c.id = h.conversation_id

union all
select cl.created_at::timestamptz, 'telefono', 'llamada',
  coalesce(cl.user_name,'—')::text,
  ('Llamada ' || coalesce(cl.status,'') || coalesce(' · ' || cl.duration_sec || ' s',''))::text,
  cl.outcome_note::text, null::text,
  nullif(right(regexp_replace(coalesce(cl.to_phone,''),'\D','','g'),10),'')::text,
  null::text, 'call', cl.id::text
from call_logs cl

union all
select p.created_at::timestamptz, 'propuestas', 'propuesta_enviada',
  coalesce(u.full_name,'—')::text,
  ('Propuesta ' || p.proposal_num || ' — USD ' || p.total)::text,
  p.services::text,
  lower(nullif(trim(p.client_email),''))::text, null::text,
  p.client_name::text, 'proposal', p.id::text
from proposals p left join users u on u.id = p.sent_by_id

union all
select p.payment_confirmed_at::timestamptz, 'propuestas', 'pago', 'sistema',
  ('Pago confirmado — ' || p.proposal_num)::text, null::text,
  lower(nullif(trim(p.client_email),''))::text, null::text,
  p.client_name::text, 'proposal', p.id::text
from proposals p where p.payment_confirmed_at is not null

union all
select e.created_at::timestamptz, 'propuestas', ('propuesta_' || e.kind)::text, 'sistema',
  coalesce(e.detail, e.kind)::text, e.channel::text,
  lower(nullif(trim(p.client_email),''))::text, null::text,
  p.client_name::text, 'proposal', p.id::text
from proposal_events e join proposals p on p.id = e.proposal_id

union all
select n.created_at::timestamptz, 'equipo', 'nota', n.author_name::text,
  n.content::text, null::text,
  lower(nullif(trim(a.client_email),''))::text,
  nullif(right(regexp_replace(coalesce(a.client_whatsapp,''),'\D','','g'),10),'')::text,
  a.client_company::text, 'appointment', a.id::text
from appointment_notes n join appointments a on a.id = n.appointment_id

union all
select w.created_at::timestamptz, 'web', 'lead_web', 'formulario',
  coalesce(w.servicio,'consulta web')::text, w.mensaje::text,
  lower(nullif(trim(w.email),''))::text,
  nullif(right(regexp_replace(coalesce(w.telefono_e164,''),'\D','','g'),10),'')::text,
  w.empresa::text, 'web_lead', w.id::text
from web_leads w;
