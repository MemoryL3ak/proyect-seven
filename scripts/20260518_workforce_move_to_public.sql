-- Mover módulo Workforce de schema "workforce" a "public" con prefijo
-- (Supabase Data API solo expone schemas pre-configurados; mover a public
--  simplifica la integración sin requerir cambios de configuración.)
--
-- NOTA: este script es DESTRUCTIVO. Borra las tablas existentes en workforce.*
-- Si ya cargaste datos de prueba, no los recuperarás. Ejecutar antes de operar.

-- 1) Drop del schema viejo (si existe)
drop table if exists workforce.deliveries cascade;
drop table if exists workforce.products cascade;
drop table if exists workforce.persons cascade;
drop schema if exists workforce cascade;

-- 2) Crear las 3 tablas en public con prefijo workforce_
create table if not exists public.workforce_persons (
  id uuid primary key default gen_random_uuid(),
  event_id uuid,
  full_name text not null,
  rut text,
  email text,
  phone text,
  gender text,
  address text,
  person_type text not null default 'STAFF',
  role text,
  daily_rate numeric(12,2) default 0,
  days_count int default 0,
  start_date date,
  end_date date,
  status text not null default 'ACTIVE',
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workforce_persons_event
  on public.workforce_persons (event_id);
create index if not exists idx_workforce_persons_type
  on public.workforce_persons (person_type);
create index if not exists idx_workforce_persons_rut
  on public.workforce_persons (rut) where rut is not null;

create table if not exists public.workforce_products (
  id uuid primary key default gen_random_uuid(),
  event_id uuid,
  name text not null,
  description text,
  unit_cost numeric(12,2) default 0,
  barcode text,
  has_sizes boolean default false,
  available_sizes text[] default '{}',
  stock_quantity int default 0,
  category text,
  status text not null default 'ACTIVE',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workforce_products_event
  on public.workforce_products (event_id);
create unique index if not exists uq_workforce_products_barcode
  on public.workforce_products (barcode) where barcode is not null;

create table if not exists public.workforce_deliveries (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.workforce_persons(id) on delete cascade,
  product_id uuid not null references public.workforce_products(id),
  quantity int not null default 1,
  size text,
  unit_cost numeric(12,2),
  delivered_at timestamptz,
  delivered_by text,
  validated_at timestamptz,
  validated_by text,
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_workforce_deliveries_person
  on public.workforce_deliveries (person_id);
create index if not exists idx_workforce_deliveries_product
  on public.workforce_deliveries (product_id);
create index if not exists idx_workforce_deliveries_delivered_at
  on public.workforce_deliveries (delivered_at);
