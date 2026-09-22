-- El Jefe de Misión no representa una disciplina: responde por toda su
-- delegación. La ficha de participante le pedía *una* disciplina (igual que a
-- un deportista) y no había forma de dejar registrado que cubre varias, así
-- que quedaba con un deporte suelto que no decía nada o directamente vacío.
--
-- Se agrega la lista. Mismo patrón que core.delegations.discipline_ids y
-- logistics.venues.discipline_ids: arreglo de uuid, vacío = sin asignar.
-- discipline_id (singular) se mantiene para el resto de los tipos de cliente,
-- que sí compiten en un solo deporte.

alter table core.athletes
  add column if not exists discipline_ids uuid[] not null default '{}'::uuid[];

comment on column core.athletes.discipline_ids is
  'Disciplinas asignadas cuando el participante cubre más de una (Jefe de Misión). Vacío = se usa discipline_id.';

create index if not exists idx_athletes_discipline_ids
  on core.athletes using gin (discipline_ids);

-- Arrastre: al Jefe de Misión que ya tenía una disciplina suelta se le deja
-- esa misma como primera de la lista, para no perder lo cargado.
update core.athletes
   set discipline_ids = array[discipline_id]
 where discipline_id is not null
   and discipline_ids = '{}'::uuid[]
   and upper(coalesce(user_type, '')) = 'JEFE_MISION';
