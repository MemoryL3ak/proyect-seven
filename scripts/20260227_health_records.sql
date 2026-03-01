-- Health module: normalized FUPD-style record per participant.
-- Standard table (no config/json-only dependence) + optional backfill from athletes.metadata.healthRecord.

create table if not exists core.athlete_health_records (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references core.athletes(id) on delete cascade,
  event_id uuid references core.events(id) on delete set null,
  delegation_id uuid references core.delegations(id) on delete set null,

  -- Header
  sport text,

  -- 1) Antecedentes personales
  full_name text,
  social_name text,
  gender_identity text,
  id_card_gender text,
  rut text,
  height_text text,
  weight_text text,
  birth_date date,
  allergic boolean,
  allergic_to text,
  chronic_diseases boolean,
  chronic_detail text,
  medications text,
  psychiatric_treatment boolean,
  psychiatric_treatment_detail text,
  psychiatric_diagnosis text,
  psychiatric_medications boolean,
  psychiatric_dose_schedule text,
  special_diet boolean,
  special_diet_detail text,

  -- 2) Contacto y representación
  address text,
  commune text,
  city text,
  region text,
  phone text,
  email text,
  indigenous_people boolean,
  indigenous_detail text,
  shirt_size text check (shirt_size in ('XS', 'S', 'M', 'L', 'XL', 'XXL')),
  dependency_type text check (dependency_type in ('Municipal', 'Particular subvencionado', 'Particular pagado')),
  institution_name text,
  enrolled_club boolean,
  club_name text,
  promesas_chile boolean,

  -- 3) Emergencia
  emergency_name text,
  emergency_phone text,
  emergency_email text,
  emergency_address text,
  emergency_relation text,

  -- 4) Certificado de salud compatible
  health_certificate_athlete_name text,
  health_certificate_fitness text check (health_certificate_fitness in ('APTO', 'NO_APTO')),
  health_certificate_doctor_name text,
  health_certificate_doctor_rut text,
  health_certificate_signature_stamp text,

  -- 5) Autorización padres/apoderado
  guardian_name text,
  guardian_rut text,
  guardian_signature text,

  -- 6) Certificado de pertenencia escolar
  school_establishment_name text,
  school_student_name text,
  school_student_rut text,
  school_director_name text,
  school_director_rut text,
  school_director_signature text,
  school_director_stamp text,
  school_certificate_date date,

  -- Raw snapshot for traceability/migration safety
  raw_payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists athlete_health_records_athlete_uq
  on core.athlete_health_records (athlete_id);

create index if not exists athlete_health_records_event_idx
  on core.athlete_health_records (event_id);

create index if not exists athlete_health_records_delegation_idx
  on core.athlete_health_records (delegation_id);

-- Backfill from current athletes.metadata.healthRecord, if present.
with src as (
  select
    a.id as athlete_id,
    a.event_id,
    a.delegation_id,
    coalesce(a.metadata -> 'healthRecord', '{}'::jsonb) as hr
  from core.athletes a
  where a.metadata ? 'healthRecord'
),
mapped as (
  select
    athlete_id,
    event_id,
    delegation_id,
    nullif(hr ->> 'sport', '') as sport,
    nullif(hr #>> '{personal,fullName}', '') as full_name,
    nullif(hr #>> '{personal,socialName}', '') as social_name,
    nullif(hr #>> '{personal,genderIdentity}', '') as gender_identity,
    nullif(hr #>> '{personal,idCardGender}', '') as id_card_gender,
    nullif(hr #>> '{personal,rut}', '') as rut,
    nullif(hr #>> '{personal,height}', '') as height_text,
    nullif(hr #>> '{personal,weight}', '') as weight_text,
    case
      when coalesce(hr #>> '{personal,birthDate}', '') ~ '^\d{4}-\d{2}-\d{2}$'
        then (hr #>> '{personal,birthDate}')::date
      else null
    end as birth_date,
    case upper(coalesce(hr #>> '{personal,allergic}', ''))
      when 'SI' then true when 'NO' then false else null
    end as allergic,
    nullif(hr #>> '{personal,allergicTo}', '') as allergic_to,
    case upper(coalesce(hr #>> '{personal,chronicDiseases}', ''))
      when 'SI' then true when 'NO' then false else null
    end as chronic_diseases,
    nullif(hr #>> '{personal,chronicDetail}', '') as chronic_detail,
    nullif(hr #>> '{personal,medications}', '') as medications,
    case upper(coalesce(hr #>> '{personal,psychiatricTreatment}', ''))
      when 'SI' then true when 'NO' then false else null
    end as psychiatric_treatment,
    nullif(hr #>> '{personal,psychiatricDetail}', '') as psychiatric_treatment_detail,
    nullif(hr #>> '{personal,psychiatricDiagnosis}', '') as psychiatric_diagnosis,
    case upper(coalesce(hr #>> '{personal,psychiatricMedications}', ''))
      when 'SI' then true when 'NO' then false else null
    end as psychiatric_medications,
    nullif(hr #>> '{personal,psychiatricDoseSchedule}', '') as psychiatric_dose_schedule,
    case upper(coalesce(hr #>> '{personal,specialDiet}', ''))
      when 'SI' then true when 'NO' then false else null
    end as special_diet,
    nullif(hr #>> '{personal,specialDietDetail}', '') as special_diet_detail,
    nullif(hr #>> '{contact,address}', '') as address,
    nullif(hr #>> '{contact,commune}', '') as commune,
    nullif(hr #>> '{contact,city}', '') as city,
    nullif(hr #>> '{contact,region}', '') as region,
    nullif(hr #>> '{contact,phone}', '') as phone,
    nullif(hr #>> '{contact,email}', '') as email,
    case upper(coalesce(hr #>> '{contact,indigenous}', ''))
      when 'SI' then true when 'NO' then false else null
    end as indigenous_people,
    nullif(hr #>> '{contact,indigenousDetail}', '') as indigenous_detail,
    nullif(hr #>> '{contact,shirtSize}', '') as shirt_size,
    nullif(hr #>> '{representation,dependencyType}', '') as dependency_type,
    nullif(hr #>> '{representation,institutionName}', '') as institution_name,
    case upper(coalesce(hr #>> '{representation,enrolledClub}', ''))
      when 'SI' then true when 'NO' then false else null
    end as enrolled_club,
    nullif(hr #>> '{representation,clubName}', '') as club_name,
    case upper(coalesce(hr #>> '{representation,promesasChile}', ''))
      when 'SI' then true when 'NO' then false else null
    end as promesas_chile,
    nullif(hr #>> '{emergency,name}', '') as emergency_name,
    nullif(hr #>> '{emergency,phone}', '') as emergency_phone,
    nullif(hr #>> '{emergency,email}', '') as emergency_email,
    nullif(hr #>> '{emergency,address}', '') as emergency_address,
    nullif(hr #>> '{emergency,relation}', '') as emergency_relation,
    nullif(hr #>> '{healthCertificate,athleteName}', '') as health_certificate_athlete_name,
    nullif(hr #>> '{healthCertificate,fitness}', '') as health_certificate_fitness,
    nullif(hr #>> '{healthCertificate,doctorName}', '') as health_certificate_doctor_name,
    nullif(hr #>> '{healthCertificate,doctorRut}', '') as health_certificate_doctor_rut,
    nullif(hr #>> '{healthCertificate,signatureStamp}', '') as health_certificate_signature_stamp,
    nullif(hr #>> '{guardianAuthorization,guardianName}', '') as guardian_name,
    nullif(hr #>> '{guardianAuthorization,guardianRut}', '') as guardian_rut,
    nullif(hr #>> '{guardianAuthorization,guardianSignature}', '') as guardian_signature,
    nullif(hr #>> '{schoolCertificate,establishmentName}', '') as school_establishment_name,
    nullif(hr #>> '{schoolCertificate,studentName}', '') as school_student_name,
    nullif(hr #>> '{schoolCertificate,studentRut}', '') as school_student_rut,
    nullif(hr #>> '{schoolCertificate,directorName}', '') as school_director_name,
    nullif(hr #>> '{schoolCertificate,directorRut}', '') as school_director_rut,
    nullif(hr #>> '{schoolCertificate,directorSignature}', '') as school_director_signature,
    nullif(hr #>> '{schoolCertificate,directorStamp}', '') as school_director_stamp,
    case
      when coalesce(hr #>> '{schoolCertificate,certificateDate}', '') ~ '^\d{4}-\d{2}-\d{2}$'
        then (hr #>> '{schoolCertificate,certificateDate}')::date
      else null
    end as school_certificate_date,
    hr as raw_payload
  from src
)
insert into core.athlete_health_records (
  athlete_id,
  event_id,
  delegation_id,
  sport,
  full_name,
  social_name,
  gender_identity,
  id_card_gender,
  rut,
  height_text,
  weight_text,
  birth_date,
  allergic,
  allergic_to,
  chronic_diseases,
  chronic_detail,
  medications,
  psychiatric_treatment,
  psychiatric_treatment_detail,
  psychiatric_diagnosis,
  psychiatric_medications,
  psychiatric_dose_schedule,
  special_diet,
  special_diet_detail,
  address,
  commune,
  city,
  region,
  phone,
  email,
  indigenous_people,
  indigenous_detail,
  shirt_size,
  dependency_type,
  institution_name,
  enrolled_club,
  club_name,
  promesas_chile,
  emergency_name,
  emergency_phone,
  emergency_email,
  emergency_address,
  emergency_relation,
  health_certificate_athlete_name,
  health_certificate_fitness,
  health_certificate_doctor_name,
  health_certificate_doctor_rut,
  health_certificate_signature_stamp,
  guardian_name,
  guardian_rut,
  guardian_signature,
  school_establishment_name,
  school_student_name,
  school_student_rut,
  school_director_name,
  school_director_rut,
  school_director_signature,
  school_director_stamp,
  school_certificate_date,
  raw_payload
)
select
  athlete_id,
  event_id,
  delegation_id,
  sport,
  full_name,
  social_name,
  gender_identity,
  id_card_gender,
  rut,
  height_text,
  weight_text,
  birth_date,
  allergic,
  allergic_to,
  chronic_diseases,
  chronic_detail,
  medications,
  psychiatric_treatment,
  psychiatric_treatment_detail,
  psychiatric_diagnosis,
  psychiatric_medications,
  psychiatric_dose_schedule,
  special_diet,
  special_diet_detail,
  address,
  commune,
  city,
  region,
  phone,
  email,
  indigenous_people,
  indigenous_detail,
  shirt_size,
  dependency_type,
  institution_name,
  enrolled_club,
  club_name,
  promesas_chile,
  emergency_name,
  emergency_phone,
  emergency_email,
  emergency_address,
  emergency_relation,
  health_certificate_athlete_name,
  health_certificate_fitness,
  health_certificate_doctor_name,
  health_certificate_doctor_rut,
  health_certificate_signature_stamp,
  guardian_name,
  guardian_rut,
  guardian_signature,
  school_establishment_name,
  school_student_name,
  school_student_rut,
  school_director_name,
  school_director_rut,
  school_director_signature,
  school_director_stamp,
  school_certificate_date,
  raw_payload
from mapped
on conflict (athlete_id)
do update
set
  event_id = excluded.event_id,
  delegation_id = excluded.delegation_id,
  sport = excluded.sport,
  full_name = excluded.full_name,
  social_name = excluded.social_name,
  gender_identity = excluded.gender_identity,
  id_card_gender = excluded.id_card_gender,
  rut = excluded.rut,
  height_text = excluded.height_text,
  weight_text = excluded.weight_text,
  birth_date = excluded.birth_date,
  allergic = excluded.allergic,
  allergic_to = excluded.allergic_to,
  chronic_diseases = excluded.chronic_diseases,
  chronic_detail = excluded.chronic_detail,
  medications = excluded.medications,
  psychiatric_treatment = excluded.psychiatric_treatment,
  psychiatric_treatment_detail = excluded.psychiatric_treatment_detail,
  psychiatric_diagnosis = excluded.psychiatric_diagnosis,
  psychiatric_medications = excluded.psychiatric_medications,
  psychiatric_dose_schedule = excluded.psychiatric_dose_schedule,
  special_diet = excluded.special_diet,
  special_diet_detail = excluded.special_diet_detail,
  address = excluded.address,
  commune = excluded.commune,
  city = excluded.city,
  region = excluded.region,
  phone = excluded.phone,
  email = excluded.email,
  indigenous_people = excluded.indigenous_people,
  indigenous_detail = excluded.indigenous_detail,
  shirt_size = excluded.shirt_size,
  dependency_type = excluded.dependency_type,
  institution_name = excluded.institution_name,
  enrolled_club = excluded.enrolled_club,
  club_name = excluded.club_name,
  promesas_chile = excluded.promesas_chile,
  emergency_name = excluded.emergency_name,
  emergency_phone = excluded.emergency_phone,
  emergency_email = excluded.emergency_email,
  emergency_address = excluded.emergency_address,
  emergency_relation = excluded.emergency_relation,
  health_certificate_athlete_name = excluded.health_certificate_athlete_name,
  health_certificate_fitness = excluded.health_certificate_fitness,
  health_certificate_doctor_name = excluded.health_certificate_doctor_name,
  health_certificate_doctor_rut = excluded.health_certificate_doctor_rut,
  health_certificate_signature_stamp = excluded.health_certificate_signature_stamp,
  guardian_name = excluded.guardian_name,
  guardian_rut = excluded.guardian_rut,
  guardian_signature = excluded.guardian_signature,
  school_establishment_name = excluded.school_establishment_name,
  school_student_name = excluded.school_student_name,
  school_student_rut = excluded.school_student_rut,
  school_director_name = excluded.school_director_name,
  school_director_rut = excluded.school_director_rut,
  school_director_signature = excluded.school_director_signature,
  school_director_stamp = excluded.school_director_stamp,
  school_certificate_date = excluded.school_certificate_date,
  raw_payload = excluded.raw_payload,
  updated_at = now();
