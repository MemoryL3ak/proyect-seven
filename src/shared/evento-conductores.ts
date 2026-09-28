/**
 * Conductores de un evento, en SQL (28-09-2026). Un chofer trabaja en los
 * eventos de su proveedor (core.providers.event_ids; vacío = en todos) y,
 * además, en cualquier evento donde tenga un viaje asignado. Con World Rugby
 * elegido, Monitoreo de Conductores mostraba a los 81 choferes de los Juegos
 * Escolares en Valparaíso.
 *
 * No se usa el evento del punto GPS: el shell nativo transmite sin evento y
 * ese filtro dejaba el mapa vacío (ver DriverPresenceService.list).
 *
 * Una persona quitada del evento (metadata.eventosExcluidos, ver
 * provider-participants/eventos-persona.ts) no cuenta, salvo que tenga un
 * viaje en él.
 *
 * `param` es el marcador del uuid del evento ('$3'); `columna`, el id del
 * chofer en la consulta que lo usa.
 */
export const eventoDriversCondition = (param: string, columna: string) => `(
  ${columna} in (
    select pp.id from core.provider_participants pp
      left join core.providers p on p.id = pp.provider_id
     where (p.id is null
        or coalesce(cardinality(p.event_ids), 0) = 0
        or ${param} = any(p.event_ids))
       and not coalesce(pp.metadata->'eventosExcluidos', '[]'::jsonb) @> jsonb_build_array(${param}::text))
  or ${columna} in (
    select t.driver_id from transport.trips t
     where t.event_id = ${param}
       and t.driver_id is not null
       and t.status <> 'CANCELLED'))`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El evento pedido, sólo si es un uuid válido (si no, no se filtra). */
export const eventoValido = (eventId?: string | null): string | null =>
  eventId && UUID.test(eventId) ? eventId : null;
