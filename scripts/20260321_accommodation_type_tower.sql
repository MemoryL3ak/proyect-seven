-- Tipo de alojamiento (Hotel / Villa) y torre para Villas Panamericanas

alter table logistics.accommodations
  add column if not exists accommodation_type varchar(20) not null default 'HOTEL',
  add column if not exists tower varchar(50) null;

comment on column logistics.accommodations.accommodation_type
  is 'Tipo de alojamiento: HOTEL o VILLA';

comment on column logistics.accommodations.tower
  is 'Torre de la villa (solo aplica cuando accommodation_type = VILLA)';
