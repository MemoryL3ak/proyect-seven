-- Alojamiento por delegación y disciplina.
--
-- Hasta ahora el hotel se asignaba participante por participante. La
-- distribución real de los Juegos Escolares se decide de otra forma: una
-- planilla con las regiones en las filas y los deportes en las columnas, y en
-- cada cruce el hotel donde se aloja esa selección. Hay dos planillas, damas
-- y varones, porque en los deportes mixtos (atletismo, natación, judo,
-- ajedrez, ciclismo, tenis de mesa, paraatletismo) cada rama puede quedar en
-- un hotel distinto.
--
-- La rama se guarda aparte del deporte a propósito: en los deportes que ya
-- vienen separados por género (fútsal, vóleibol, balonmano, básquetbol) es
-- redundante y coincide con el género de la disciplina, pero en los mixtos es
-- lo único que distingue una celda de la otra.

create table if not exists logistics.delegation_hotels (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references core.events(id) on delete cascade,
  delegation_id uuid not null references core.delegations(id) on delete cascade,
  discipline_id uuid not null references core.disciplines(id) on delete cascade,
  branch text not null check (branch in ('DAMAS', 'VARONES')),
  accommodation_id uuid references logistics.accommodations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delegation_hotels_celda_unica
    unique (event_id, delegation_id, discipline_id, branch)
);

create index if not exists delegation_hotels_evento_idx
  on logistics.delegation_hotels (event_id);

create index if not exists delegation_hotels_delegacion_idx
  on logistics.delegation_hotels (delegation_id);
