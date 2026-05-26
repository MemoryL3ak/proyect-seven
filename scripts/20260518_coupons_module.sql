-- Módulo Cupones de descuento
--
-- Catálogo de cupones que el comité pone a disposición de atletas, VIPs y staff.
-- Cada cupón tiene un código que el usuario presenta a un comercio/conserje para canjear.

-- ============================================================================
-- 1) Catálogo de cupones
-- ============================================================================
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  event_id uuid,
  code text not null,                       -- código que se muestra al usuario
  title text not null,                      -- "20% OFF en McDonald's"
  description text,                         -- descripción larga
  category text not null default 'OTHER',   -- COMIDA | ENTRETENIMIENTO | TIENDA | OTHER
  discount_type text default 'PERCENTAGE',  -- PERCENTAGE | AMOUNT | FREE | TEXT
  discount_value numeric(10,2),             -- valor del descuento (depende del tipo)
  terms_and_conditions text,                -- letra chica
  partner_name text,                        -- "McDonald's", "Cinépolis", etc.
  partner_logo_url text,                    -- logo opcional
  partner_address text,                     -- dirección del local
  valid_from timestamptz,                   -- desde cuándo es válido
  valid_until timestamptz,                  -- hasta cuándo
  max_redemptions int,                      -- cantidad máxima total (null = ilimitado)
  per_user_limit int default 1,             -- cuántas veces puede usarlo cada persona
  audience text[] default '{}',             -- tipos de usuario que pueden verlo: ATHLETE, VIP, STAFF, DELEGATION_LEAD
  status text not null default 'ACTIVE',    -- ACTIVE | INACTIVE | EXPIRED
  image_url text,                           -- imagen destacada del cupón
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_coupons_code_event
  on public.coupons (code, coalesce(event_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists idx_coupons_event
  on public.coupons (event_id);
create index if not exists idx_coupons_category
  on public.coupons (category);
create index if not exists idx_coupons_status
  on public.coupons (status);
create index if not exists idx_coupons_valid_until
  on public.coupons (valid_until) where status = 'ACTIVE';

comment on column public.coupons.category
  is 'COMIDA | ENTRETENIMIENTO | TIENDA | OTHER';

comment on column public.coupons.discount_type
  is 'PERCENTAGE (descuento %), AMOUNT (monto fijo), FREE (gratis), TEXT (descripción libre)';

comment on column public.coupons.audience
  is 'Tipos de usuario que pueden ver el cupón. Vacío = todos. Valores: ATHLETE, VIP, STAFF, DELEGATION_LEAD.';

-- ============================================================================
-- 2) Redenciones (registro de canjes)
-- ============================================================================
create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  user_id uuid,                             -- a quién pertenece (athlete/participant)
  user_type text,                           -- ATHLETE | VIP | STAFF | DELEGATION_LEAD
  user_name text,                           -- snapshot del nombre al canjear
  redeemed_at timestamptz not null default now(),
  redeemed_by text,                         -- quién validó el canje (operador/comercio)
  location text,                            -- dónde se canjeó
  notes text,
  metadata jsonb default '{}'::jsonb
);

create index if not exists idx_coupon_redemptions_coupon
  on public.coupon_redemptions (coupon_id);
create index if not exists idx_coupon_redemptions_user
  on public.coupon_redemptions (user_id) where user_id is not null;
create index if not exists idx_coupon_redemptions_redeemed_at
  on public.coupon_redemptions (redeemed_at);

comment on table public.coupon_redemptions
  is 'Registro histórico de cada canje. Sirve para enforcement de limits (per_user_limit, max_redemptions).';
