-- Presentación del conductor: 30 minutos antes de la hora del traslado.
-- El jefe de misión y el pasajero ven scheduled_at; el portal del conductor
-- muestra presentation_at. Desde ahora el backend la calcula al guardar el
-- viaje (TripsService.toRow); esto completa los viajes ya creados.

update transport.trips
   set presentation_at = scheduled_at - interval '30 minutes'
 where presentation_at is null
   and scheduled_at is not null;
