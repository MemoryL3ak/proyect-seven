-- 24-09-2026. La sede "Gimnasio UTFSM" pasó a llamarse "Gimnasio UTFSM -
-- José Miguel Carrera" el 21-09, pero los viajes guardan el lugar como texto
-- (la planilla lo trae así) y sin id de sede, así que siguieron diciendo
-- "Gimnasio UTFSM" y no calzaban con el filtro de sede. Se enlazan a la sede
-- por id y se les pone el nombre actual. Idempotente.
with sede as (
  select id, name from logistics.venues where name = 'Gimnasio UTFSM - José Miguel Carrera'
)
update transport.trips t
   set destination_venue_id = coalesce(t.destination_venue_id, sede.id),
       destination = sede.name
  from sede
 where t.destination = 'Gimnasio UTFSM'
    or (t.destination_venue_id = sede.id and t.destination <> sede.name);

with sede as (
  select id, name from logistics.venues where name = 'Gimnasio UTFSM - José Miguel Carrera'
)
update transport.trips t
   set origin_venue_id = coalesce(t.origin_venue_id, sede.id),
       origin = sede.name
  from sede
 where t.origin = 'Gimnasio UTFSM'
    or (t.origin_venue_id = sede.id and t.origin <> sede.name);
