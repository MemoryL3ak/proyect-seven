-- Foto del hotel/alojamiento para mostrarla en los portales.
-- Se sube vía POST /accommodations/:id/photo (bucket venue-photos, carpeta hotels/).
alter table logistics.accommodations
  add column if not exists photo_url text;

comment on column logistics.accommodations.photo_url is
  'URL pública de la foto del alojamiento (storage venue-photos/hotels).';
