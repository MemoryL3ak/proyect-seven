-- Accreditation-level access assignment for credentials.
-- Allowed codes: C, TR, H, R, A, RD

alter table if exists core.accreditations
  add column if not exists access_types text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'accreditations_access_types_allowed_ck'
      and conrelid = 'core.accreditations'::regclass
  ) then
    alter table core.accreditations
      add constraint accreditations_access_types_allowed_ck
      check (access_types <@ array['C', 'TR', 'H', 'R', 'A', 'RD']::text[]);
  end if;
end $$;

update core.accreditations a
set access_types = coalesce(d.access_types, '{}'::text[])
from transport.drivers d
where a.subject_type = 'DRIVER'
  and a.driver_id = d.id
  and coalesce(array_length(a.access_types, 1), 0) = 0;
