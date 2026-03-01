-- Normalized expected capacity by event + discipline + delegation (country code).
-- Replaces dependence on events.config for AND planning.

create table if not exists core.event_expected_capacities (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references core.events(id) on delete cascade,
  discipline_id uuid not null references core.disciplines(id) on delete cascade,
  delegation_code char(3) not null,
  expected_count int not null default 0 check (expected_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists event_expected_capacities_event_discipline_delegation_uq
  on core.event_expected_capacities (event_id, discipline_id, delegation_code);

create index if not exists event_expected_capacities_event_idx
  on core.event_expected_capacities (event_id);

create index if not exists event_expected_capacities_discipline_idx
  on core.event_expected_capacities (discipline_id);

create index if not exists event_expected_capacities_delegation_idx
  on core.event_expected_capacities (delegation_code);

-- Backfill from legacy events.config.andExpectedByDisciplineDelegation.
with legacy_matrix as (
  select
    e.id as event_id,
    m.key as discipline_key,
    r.key as delegation_key,
    r.value as expected_raw
  from core.events e
  cross join lateral jsonb_each(coalesce(e.config -> 'andExpectedByDisciplineDelegation', '{}'::jsonb)) m
  cross join lateral jsonb_each_text(
    case
      when jsonb_typeof(m.value) = 'object' then m.value
      else '{}'::jsonb
    end
  ) r
),
normalized as (
  select
    lm.event_id,
    lm.discipline_key::uuid as discipline_id,
    upper(
      trim(
        coalesce(d.country_code, lm.delegation_key)
      )
    ) as delegation_code,
    greatest(
      case
        when lm.expected_raw ~ '^-?\d+(\.\d+)?$'
          then floor((lm.expected_raw)::numeric)::int
        else 0
      end,
      0
    ) as expected_count
  from legacy_matrix lm
  left join core.delegations d
    on d.id::text = lm.delegation_key
   and d.event_id = lm.event_id
  where lm.discipline_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
)
insert into core.event_expected_capacities (
  event_id,
  discipline_id,
  delegation_code,
  expected_count
)
select
  n.event_id,
  n.discipline_id,
  n.delegation_code::char(3),
  max(n.expected_count) as expected_count
from normalized n
where n.delegation_code ~ '^[A-Z]{3}$'
group by n.event_id, n.discipline_id, n.delegation_code
on conflict (event_id, discipline_id, delegation_code)
do update
set expected_count = excluded.expected_count,
    updated_at = now();
