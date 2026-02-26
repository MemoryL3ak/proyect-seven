-- Sports calendar module.
create table if not exists core.sports_calendar_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references core.events(id) on delete set null,
  sport text not null,
  league text not null,
  season text,
  home_team text,
  away_team text,
  venue text,
  start_at_utc timestamptz not null,
  status text not null default 'SCHEDULED',
  score_home int,
  score_away int,
  external_id text,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table core.sports_calendar_events
  add column if not exists event_id uuid references core.events(id) on delete set null;

alter table core.sports_calendar_events
  alter column home_team drop not null,
  alter column away_team drop not null;

create unique index if not exists sports_calendar_events_external_id_source_uq
  on core.sports_calendar_events (external_id, source)
  where external_id is not null and source is not null;

create index if not exists sports_calendar_events_start_at_idx
  on core.sports_calendar_events (start_at_utc);

create index if not exists sports_calendar_events_league_idx
  on core.sports_calendar_events (league);

create index if not exists sports_calendar_events_sport_idx
  on core.sports_calendar_events (sport);

create index if not exists sports_calendar_events_status_idx
  on core.sports_calendar_events (status);

create index if not exists sports_calendar_events_event_idx
  on core.sports_calendar_events (event_id);
