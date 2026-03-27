-- Pre-checkin para asignaciones de hotel
-- Registra cuándo un participante llega antes de la fecha de checkin planificada

alter table logistics.hotel_assignments
  add column if not exists pre_checkin_at timestamptz null;

comment on column logistics.hotel_assignments.pre_checkin_at
  is 'Fecha/hora real de llegada anticipada. Nulo si el participante llegó en la fecha planificada.';
