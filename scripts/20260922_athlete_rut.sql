-- RUT del participante.
--
-- El formulario de Participantes pedía el RUT desde siempre y la API lo
-- descartaba en silencio: core.athletes no tenía la columna, así que el campo
-- viajaba en cada alta y se perdía. transport.drivers y core.provider_participants
-- ya lo guardan como columna propia; esto deja a los participantes igual.
--
-- CORRER ESTO ANTES DE DESPLEGAR EL BACKEND: sin la columna, el insert de un
-- participante falla entero con "column athletes.rut does not exist".

alter table core.athletes
  add column if not exists rut text;

-- Buscar un participante por RUT es lo primero que se hace en acreditación.
create index if not exists athletes_rut_idx
  on core.athletes (rut)
  where rut is not null;
