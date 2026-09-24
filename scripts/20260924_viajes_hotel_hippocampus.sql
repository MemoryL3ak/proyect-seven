-- 24-09-2026. 64 extremos de viaje decían "Hotel Hippocampus" sin id de
-- hotel: en el catálogo el hotel es "Hippocampus Resort § Club" y el import
-- sólo enlazaba por nombre exacto. Se enlazan por id y toman el nombre del
-- catálogo. Idempotente.
with hotel as (
  select id, name from logistics.accommodations where name = 'Hippocampus Resort § Club'
)
update transport.trips t
   set destination_hotel_id = coalesce(t.destination_hotel_id, hotel.id),
       destination = hotel.name
  from hotel
 where t.destination = 'Hotel Hippocampus'
    or (t.destination_hotel_id = hotel.id and t.destination <> hotel.name);

with hotel as (
  select id, name from logistics.accommodations where name = 'Hippocampus Resort § Club'
)
update transport.trips t
   set origin_hotel_id = coalesce(t.origin_hotel_id, hotel.id),
       origin = hotel.name
  from hotel
 where t.origin = 'Hotel Hippocampus'
    or (t.origin_hotel_id = hotel.id and t.origin <> hotel.name);
