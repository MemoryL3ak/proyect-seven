-- Coordinador de sede: se elige de una lista, no se escribe a mano.
--
-- La sede ya tenía `coordinator_name` y `coordinator_phone` como texto libre:
-- cada quien escribía el nombre a su manera, el teléfono quedaba desactualizado
-- respecto de la ficha de la persona, y no había forma de saber qué sedes tiene
-- a cargo un coordinador.
--
-- Ahora la sede apunta al participante con rol "Coordinador de Sede"
-- (core.athletes.user_type = 'COORDINADOR_SEDE'). Las columnas de texto se
-- mantienen y el backend las rellena desde la ficha elegida, para que todo lo
-- que ya las lee —portal, tarjeta de sede, listados— siga funcionando sin
-- cambios y sin una segunda consulta.

alter table logistics.venues
  add column if not exists coordinator_id uuid;

comment on column logistics.venues.coordinator_id is
  'Participante con rol COORDINADOR_SEDE a cargo del recinto. coordinator_name y coordinator_phone son la copia de su ficha al momento de asignarlo.';

-- Si se elimina la persona, la sede queda sin coordinador en vez de impedir el
-- borrado o arrastrar la sede con ella.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'venues_coordinator_id_fkey'
  ) then
    alter table logistics.venues
      add constraint venues_coordinator_id_fkey
      foreign key (coordinator_id) references core.athletes(id) on delete set null;
  end if;
end $$;

create index if not exists venues_coordinator_id_idx
  on logistics.venues (coordinator_id)
  where coordinator_id is not null;

-- Verificación: las 15 sedes deben quedar con la columna creada y en nulo.
select count(*) filter (where coordinator_id is null) as sin_coordinador,
       count(*) filter (where coordinator_id is not null) as con_coordinador
  from logistics.venues;
