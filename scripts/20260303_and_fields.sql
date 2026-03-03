-- AND participant fields persisted directly on core.athletes.

alter table core.athletes
  add column if not exists phone text,
  add column if not exists visa_required boolean,
  add column if not exists trip_type text,
  add column if not exists bolso_count integer not null default 0,
  add column if not exists bag_8_count integer not null default 0,
  add column if not exists suitcase_10_count integer not null default 0,
  add column if not exists suitcase_15_count integer not null default 0,
  add column if not exists suitcase_23_count integer not null default 0,
  add column if not exists oversize_text text,
  add column if not exists luggage_volume text,
  add column if not exists wheelchair_user boolean not null default false,
  add column if not exists wheelchair_standard_count integer not null default 0,
  add column if not exists wheelchair_sport_count integer not null default 0,
  add column if not exists sports_equipment text,
  add column if not exists requires_assistance boolean not null default false,
  add column if not exists observations text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'athletes_trip_type_ck'
      and conrelid = 'core.athletes'::regclass
  ) then
    alter table core.athletes
      add constraint athletes_trip_type_ck
      check (trip_type in ('ARRIVAL', 'DEPARTURE') or trip_type is null);
  end if;
end $$;
