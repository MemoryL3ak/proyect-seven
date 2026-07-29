-- Menús de alimentación: audiencia por tipo de cliente, sede y detalle del
-- lugar (p.ej. "Comedor principal, piso 2"). Los portales filtran por el tipo
-- de cliente del usuario; el detalle del lugar se muestra junto al menú.
alter table logistics.food_menus
  add column if not exists client_types text[] not null default '{}',
  add column if not exists venue_id uuid references logistics.venues(id) on delete set null,
  add column if not exists location_detail text;

comment on column logistics.food_menus.client_types is
  'Tipos de cliente que ven este menú (vacío = todos).';
comment on column logistics.food_menus.location_detail is
  'Detalle del lugar donde se sirve (comedor, piso, salón).';
