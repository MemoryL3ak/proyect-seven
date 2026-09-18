-- Juegos Deportivos Escolares 2026: el traslado se asigna al grupo
-- (delegación = región + disciplina), no a un participante en particular.
-- El Jefe de Misión ve todos los viajes de su delegación.
--
-- Ambas columnas son opcionales: los viajes de otros eventos (VIP, T1) siguen
-- funcionando por solicitante y pasajeros.

alter table transport.trips
  add column if not exists delegation_id uuid references core.delegations(id) on delete set null;

alter table transport.trips
  add column if not exists discipline_id uuid references core.disciplines(id) on delete set null;

create index if not exists idx_trips_delegation on transport.trips (delegation_id);
create index if not exists idx_trips_discipline on transport.trips (discipline_id);
