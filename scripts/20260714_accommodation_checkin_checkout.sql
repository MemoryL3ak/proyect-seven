-- Agrega fechas de check-in / check-out a nivel de alojamiento (hotel).
-- Estas son las fechas de la estadía del evento para ese hotel; se muestran
-- en el portal (sección Hoteles) y se gestionan desde el módulo de hotelería.

alter table logistics.accommodations
  add column if not exists check_in  timestamptz,
  add column if not exists check_out timestamptz;
