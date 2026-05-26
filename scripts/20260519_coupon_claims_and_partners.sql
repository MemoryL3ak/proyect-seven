-- Módulo Cupones — Sistema de claims (reservas con QR) + Partners (comercios)
--
-- Extiende public.coupons para soportar:
--   1) "Claim": el atleta reclama un cupón → se genera código único + QR
--   2) "Partner": el comercio (McDonald's, etc.) escanea el QR para canjear
--   3) Sesiones simples del partner (auth por código + PIN)
--
-- Modelo de estados de un claim:
--   CLAIMED   → reservado por el atleta, esperando canje (expira en 48h)
--   REDEEMED  → canjeado por el partner
--   EXPIRED   → no se canjeó dentro de la ventana
--   REVOKED   → anulado manualmente por admin

-- ============================================================================
-- 1) Claims (reservas con QR)
-- ============================================================================
create table if not exists public.coupon_claims (
  id              uuid primary key default gen_random_uuid(),
  coupon_id       uuid not null references public.coupons(id) on delete cascade,

  -- a quién pertenece el claim
  user_id         text not null,
  user_type       text,                     -- ATHLETE | VIP | STAFF | DELEGATION_LEAD
  user_name       text,
  user_email      text,

  -- credenciales para canjear
  unique_code     text not null unique,     -- "CPN-AB12CD" (humano, backup si QR falla)
  qr_token        text not null unique,     -- 64 hex (criptográfico, lo que va en el QR)

  -- estado
  status          text not null default 'CLAIMED'
                  check (status in ('CLAIMED','REDEEMED','EXPIRED','REVOKED')),

  -- ciclo de vida
  claimed_at      timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '48 hours'),
  redeemed_at     timestamptz,
  revoked_at      timestamptz,

  -- detalle del canje
  redeemed_partner_id uuid,                 -- ↗ coupon_partners.id (FK abajo)
  redeemed_by         text,                 -- nombre del operador del partner
  redemption_location text,
  notes               text,

  metadata        jsonb default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_coupon_claims_coupon       on public.coupon_claims (coupon_id);
create index if not exists idx_coupon_claims_user         on public.coupon_claims (user_id);
create index if not exists idx_coupon_claims_status       on public.coupon_claims (status);
create index if not exists idx_coupon_claims_expires_at   on public.coupon_claims (expires_at) where status = 'CLAIMED';

-- trigger updated_at
create or replace function public.tg_coupon_claims_touch() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_coupon_claims_touch on public.coupon_claims;
create trigger trg_coupon_claims_touch
  before update on public.coupon_claims
  for each row execute function public.tg_coupon_claims_touch();

comment on table public.coupon_claims is
  'Reservas de cupones (un atleta reclama → recibe QR + código único). Se canjea presentándolo en el partner.';

-- ============================================================================
-- 2) Partners (comercios habilitados)
-- ============================================================================
create table if not exists public.coupon_partners (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid,

  -- identidad
  code            text not null,            -- "MCDO-001" (lo tipea el operador al hacer login)
  name            text not null,            -- "McDonald's Las Condes"
  address         text,
  logo_url        text,
  contact_name    text,
  contact_phone   text,

  -- auth
  pin_hash        text not null,            -- bcrypt del PIN

  -- alcance: qué cupones puede canjear este partner (null/empty = todos)
  allowed_coupon_ids uuid[] default '{}',

  -- estado
  active          boolean not null default true,

  metadata        jsonb default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists uq_coupon_partners_code_event
  on public.coupon_partners (code, coalesce(event_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists idx_coupon_partners_active on public.coupon_partners (active);

create or replace function public.tg_coupon_partners_touch() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_coupon_partners_touch on public.coupon_partners;
create trigger trg_coupon_partners_touch
  before update on public.coupon_partners
  for each row execute function public.tg_coupon_partners_touch();

comment on table public.coupon_partners is
  'Comercios habilitados para canjear cupones. Login con código + PIN.';

-- FK suave: redeemed_partner_id en claims → coupon_partners.id
alter table public.coupon_claims
  drop constraint if exists fk_coupon_claims_partner;
alter table public.coupon_claims
  add constraint fk_coupon_claims_partner
  foreign key (redeemed_partner_id) references public.coupon_partners(id) on delete set null;

-- ============================================================================
-- 3) Sesiones del partner
-- ============================================================================
create table if not exists public.coupon_partner_sessions (
  id              uuid primary key default gen_random_uuid(),
  partner_id      uuid not null references public.coupon_partners(id) on delete cascade,
  token           text not null unique,     -- random 64 hex
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '12 hours'),
  last_used_at    timestamptz,
  user_agent      text,
  ip              text
);

create index if not exists idx_coupon_partner_sessions_partner on public.coupon_partner_sessions (partner_id);
create index if not exists idx_coupon_partner_sessions_expires on public.coupon_partner_sessions (expires_at);

comment on table public.coupon_partner_sessions is
  'Tokens de sesión activos. El frontend del partner los guarda en localStorage.';

-- ============================================================================
-- 4) Helper: expirar claims vencidos (llamar desde un cron o lazy en el servicio)
-- ============================================================================
create or replace function public.expire_overdue_coupon_claims() returns integer as $$
declare
  affected integer;
begin
  update public.coupon_claims
    set status = 'EXPIRED'
    where status = 'CLAIMED'
      and expires_at < now();
  get diagnostics affected = row_count;
  return affected;
end;
$$ language plpgsql;
