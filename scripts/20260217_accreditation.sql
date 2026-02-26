-- Accreditation workflow for participants (athletes) and drivers.

-- Snapshot fields on participants.
alter table core.athletes
  add column if not exists accreditation_status text not null default 'PENDING',
  add column if not exists accreditation_validated_at timestamptz,
  add column if not exists accreditation_validated_by text,
  add column if not exists accreditation_notes text,
  add column if not exists credential_code text,
  add column if not exists credential_issued_at timestamptz,
  add column if not exists credential_issued_by text;

-- Snapshot fields on drivers.
alter table transport.drivers
  add column if not exists accreditation_status text not null default 'PENDING',
  add column if not exists accreditation_validated_at timestamptz,
  add column if not exists accreditation_validated_by text,
  add column if not exists accreditation_notes text,
  add column if not exists credential_code text,
  add column if not exists credential_issued_at timestamptz,
  add column if not exists credential_issued_by text;

-- Centralized accreditation process by event/person.
create table if not exists core.accreditations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references core.events(id) on delete cascade,
  athlete_id uuid references core.athletes(id) on delete cascade,
  driver_id uuid references transport.drivers(id) on delete cascade,
  subject_type text not null,
  status text not null default 'PENDING',
  validation_notes text,
  validated_by text,
  validated_at timestamptz,
  credential_code text,
  credential_issued_at timestamptz,
  credential_issued_by text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accreditations_subject_type_ck
    check (subject_type in ('PARTICIPANT', 'DRIVER')),
  constraint accreditations_status_ck
    check (status in ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CREDENTIAL_ISSUED')),
  constraint accreditations_subject_ref_ck
    check (
      (subject_type = 'PARTICIPANT' and athlete_id is not null and driver_id is null)
      or
      (subject_type = 'DRIVER' and driver_id is not null and athlete_id is null)
    )
);

create unique index if not exists accreditations_event_athlete_uq
  on core.accreditations (event_id, athlete_id)
  where athlete_id is not null;

create unique index if not exists accreditations_event_driver_uq
  on core.accreditations (event_id, driver_id)
  where driver_id is not null;

create unique index if not exists accreditations_credential_code_uq
  on core.accreditations (credential_code)
  where credential_code is not null;

create index if not exists accreditations_status_idx
  on core.accreditations (status);

create index if not exists accreditations_event_idx
  on core.accreditations (event_id);
