-- Pruebas (disciplinas hijas) enlazadas a las delegaciones que participan.
-- Un partido de Futsal "Maule vs Coquimbo" guarda las dos regiones en
-- delegation_ids; una prueba de Atletismo sin delegaciones es general.
-- metadata guarda lo que trae la programación oficial y no tiene columna:
-- número de partido, grupo, fecha (jornada), salida y retorno al hotel.
alter table core.disciplines
  add column if not exists delegation_ids uuid[] not null default '{}'::uuid[],
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists disciplines_delegation_ids_idx
  on core.disciplines using gin (delegation_ids);
