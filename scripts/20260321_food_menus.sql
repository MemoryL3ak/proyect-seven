-- Food Menus: daily menu entries per meal type and accommodation
create table if not exists logistics.food_menus (
  id               uuid primary key default gen_random_uuid(),
  date             date not null,
  meal_type        text not null check (meal_type in ('DESAYUNO', 'ALMUERZO', 'CENA')),
  title            text not null,
  description      text,
  accommodation_id uuid references logistics.accommodations(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_food_menus_date on logistics.food_menus(date);
create index if not exists idx_food_menus_accommodation on logistics.food_menus(accommodation_id);
