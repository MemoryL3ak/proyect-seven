-- Módulo Workforce / Staff adicional
--
-- Gestiona el personal contratado para el evento (staff + voluntarios),
-- el catálogo de productos del kit que reciben y el registro de entregas.

create schema if not exists workforce;

-- ============================================================================
-- 1) Personas (staff y voluntarios)
-- ============================================================================
create table if not exists workforce.persons (
  id uuid primary key default gen_random_uuid(),
  event_id uuid,
  full_name text not null,
  rut text,
  email text,
  phone text,
  gender text,                            -- MALE | FEMALE | MIXED | etc.
  address text,
  person_type text not null default 'STAFF',  -- STAFF | VOLUNTEER
  role text,                              -- "Coordinador", "Apoyo logístico", etc.
  daily_rate numeric(12,2) default 0,     -- $ por día
  days_count int default 0,               -- cantidad de días contratado
  start_date date,
  end_date date,
  status text not null default 'ACTIVE',  -- ACTIVE | INACTIVE
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workforce_persons_event
  on workforce.persons (event_id);

create index if not exists idx_workforce_persons_type
  on workforce.persons (person_type);

create index if not exists idx_workforce_persons_rut
  on workforce.persons (rut) where rut is not null;

comment on column workforce.persons.person_type
  is 'Tipo de persona: STAFF (personal contratado) | VOLUNTEER (voluntariado).';

comment on column workforce.persons.daily_rate
  is 'Tarifa diaria pactada. Usado para cálculo de costo total = daily_rate * days_count.';

-- ============================================================================
-- 2) Productos del kit (catálogo)
-- ============================================================================
create table if not exists workforce.products (
  id uuid primary key default gen_random_uuid(),
  event_id uuid,
  name text not null,                     -- "Polera", "Polerón", "Pantalón", etc.
  description text,
  unit_cost numeric(12,2) default 0,      -- costo unitario
  barcode text,                           -- código de barras del producto
  has_sizes boolean default false,        -- si maneja tallas o no
  available_sizes text[] default '{}',    -- ['S', 'M', 'L', 'XL'] o ['38', '39', ...]
  stock_quantity int default 0,           -- stock total disponible
  category text,                          -- CLOTHING | ACCESSORY | EQUIPMENT
  status text not null default 'ACTIVE',  -- ACTIVE | INACTIVE
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workforce_products_event
  on workforce.products (event_id);

create unique index if not exists uq_workforce_products_barcode
  on workforce.products (barcode) where barcode is not null;

comment on column workforce.products.barcode
  is 'Código de barras del producto (un código por tipo, no por unidad).';

comment on column workforce.products.available_sizes
  is 'Tallas disponibles. Si has_sizes=false se ignora.';

-- ============================================================================
-- 3) Entregas (registro de qué recibió cada persona)
-- ============================================================================
create table if not exists workforce.deliveries (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references workforce.persons(id) on delete cascade,
  product_id uuid not null references workforce.products(id),
  quantity int not null default 1,
  size text,                              -- talla específica entregada (si aplica)
  unit_cost numeric(12,2),                -- snapshot del precio al momento de la entrega
  delivered_at timestamptz,               -- cuándo se entregó
  delivered_by text,                      -- quién entregó (operador)
  validated_at timestamptz,               -- cuándo se validó la entrega
  validated_by text,                      -- quién validó
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_workforce_deliveries_person
  on workforce.deliveries (person_id);

create index if not exists idx_workforce_deliveries_product
  on workforce.deliveries (product_id);

create index if not exists idx_workforce_deliveries_delivered_at
  on workforce.deliveries (delivered_at);

comment on column workforce.deliveries.unit_cost
  is 'Costo unitario al momento de la entrega (snapshot — no se actualiza si cambia el catálogo).';

comment on column workforce.deliveries.validated_at
  is 'Cuándo un supervisor confirmó que la entrega fue correcta. Null = pendiente de validación.';
