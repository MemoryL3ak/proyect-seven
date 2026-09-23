/**
 * Choferes que le importan a una delegación (región), en SQL.
 *
 * Son los asignados a la región en su ficha y, además, los que conducen algún
 * viaje de esa delegación —o de todas las regiones, como los buses de la
 * inauguración—. Lo segundo es lo que hace que el Jefe de Misión vea
 * su flota aunque los choferes no estén asignados a ninguna región: en la
 * operación diaria el chofer se asigna viaje a viaje.
 *
 * @param param marcador del parámetro con el id de la delegación ("$1", "$3"…).
 * @param columna columna con el id del chofer en la consulta que lo usa.
 */
export const delegationDriversCondition = (param: string, columna: string) => `(
  ${columna} in (select id from core.provider_participants where delegation_id = ${param})
  or ${columna} in (select id from transport.drivers where delegation_id = ${param})
  or ${columna} in (
    select driver_id from transport.trips
     where (delegation_id = ${param} or all_delegations) and driver_id is not null))`;
