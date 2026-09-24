-- 24-09-2026. Un viaje (6a7bf10b…, Best Western → Gimnasio UTFSM, 18:30)
-- quedó con trip_date = 2025-09-24 mientras su hora programada es el
-- 2026-09-24 18:30. El panel financiero, Operatividad Diaria y las horas
-- extra agrupan por trip_date, así que el viaje caía en 2025. Se alinea
-- trip_date con el día (hora de Chile) de scheduled_at. Idempotente.
update transport.trips
   set trip_date = (scheduled_at at time zone 'America/Santiago')::date
 where scheduled_at is not null
   and trip_date is not null
   and trip_date <> (scheduled_at at time zone 'America/Santiago')::date;
