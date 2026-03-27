-- Agrega monto licitado/presupuesto a conductores
alter table transport.drivers
  add column if not exists budget_amount numeric(14,2);

comment on column transport.drivers.budget_amount is
  'Monto presupuestado o licitado por conductor (CLP). Alimenta el dashboard comercial de Transporte.';
