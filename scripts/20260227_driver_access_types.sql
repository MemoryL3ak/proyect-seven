-- Driver access matrix for credentials and access control.
-- Allowed codes: C, TR, H, R, A, RD

alter table if exists transport.drivers
  add column if not exists access_types text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'drivers_access_types_allowed_ck'
      and conrelid = 'transport.drivers'::regclass
  ) then
    alter table transport.drivers
      add constraint drivers_access_types_allowed_ck
      check (access_types <@ array['C', 'TR', 'H', 'R', 'A', 'RD']::text[]);
  end if;
end $$;

