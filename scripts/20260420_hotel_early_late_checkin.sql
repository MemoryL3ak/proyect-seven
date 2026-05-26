-- Early check-in y late check-out para asignaciones de hotel
--
-- Distinción de los 5 momentos:
--   pre_checkin_at  : pre-ingreso (DÍAS antes de la fecha planificada)
--   early_checkin_at: el mismo día, HORAS antes del horario oficial de check-in
--   checkin_at      : check-in oficial
--   checkout_at     : check-out oficial
--   late_checkout_at: el mismo día, HORAS después del horario oficial de check-out

alter table logistics.hotel_assignments
  add column if not exists early_checkin_at timestamptz null,
  add column if not exists late_checkout_at timestamptz null;

comment on column logistics.hotel_assignments.pre_checkin_at
  is 'Pre-ingreso: el participante llega DÍAS antes de la fecha planificada de check-in.';

comment on column logistics.hotel_assignments.early_checkin_at
  is 'Early check-in: el mismo día, ingresa antes del horario oficial de check-in del hotel.';

comment on column logistics.hotel_assignments.checkin_at
  is 'Check-in oficial planificado o efectivo.';

comment on column logistics.hotel_assignments.checkout_at
  is 'Check-out oficial planificado o efectivo.';

comment on column logistics.hotel_assignments.late_checkout_at
  is 'Late check-out: el mismo día, sale después del horario oficial de check-out del hotel.';
