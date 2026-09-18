-- Tipo de recinto: una sede de competencia y un comedor son cosas distintas,
-- aunque ambos sean lugares del evento con dirección. Con esto los viajes
-- pueden tener origen o destino "Comedor" y el portal los lista aparte.

alter table logistics.venues
  add column if not exists venue_type text not null default 'SEDE';

-- LRH (ex Gala), Arlegui 263: el comedor cargado el 18-09.
update logistics.venues
   set venue_type = 'COMEDOR'
 where name ilike 'LRH%' and venue_type <> 'COMEDOR';
