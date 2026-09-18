/**
 * Hoteles de una delegación (región) en SQL.
 *
 * Son los enlazados a mano en el maestro de Delegaciones más aquellos donde
 * se aloja alguno de sus participantes, ya sea por el hotel de su ficha o por
 * su asignación hotelera. Así la alimentación y el listado de hoteles del
 * Jefe de Misión funcionan aunque nadie haya enlazado hoteles a la región.
 *
 * @param param marcador del parámetro con el id de la delegación ("$1", "$3"…).
 */
export const delegationHotelsSql = (param: string) => `(
  select accommodation_id from core.delegation_accommodations where delegation_id = ${param}
  union
  select hotel_accommodation_id from core.athletes
   where delegation_id = ${param} and hotel_accommodation_id is not null
     and status is distinct from 'DELETED'
  union
  select ha.hotel_id from logistics.hotel_assignments ha
    join core.athletes a on a.id = ha.participant_id
   where a.delegation_id = ${param})`;
