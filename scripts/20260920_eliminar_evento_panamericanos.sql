-- Elimina el evento de prueba "Juegos Panamericanos 2026" (4cc259bc…) y, con él,
-- la ficha de Flota del conductor Alex Arevalo.
--
-- Contexto (medido el 20-09-2026 contra la base):
--   * Del evento cuelgan 6.168 filas en 14 tablas, todas con FK ON DELETE
--     CASCADE, así que el DELETE final las arrastra solo.
--   * El DELETE directo FALLA con athletes_discipline_id_fkey: es la única FK
--     hacia core.disciplines declarada NO ACTION, y el atleta del JDE Benjamín
--     Alarcón quedó apuntando al "Atletismo" del evento de prueba. Por eso el
--     paso 1 lo repunta al "Atletismo" del JDE antes de borrar.
--   * Se pierden 30 filas de core.delegation_disciplines: delegaciones del JDE
--     asignadas al "Tenis de mesa" de Panamericanos. Son redundantes — las 16
--     delegaciones ya tienen esa misma disciplina en su versión del JDE.
--
-- Sobre la ficha de Flota de Alex Arevalo (se va con la cascada, decidido):
--   * Su registro en transport.drivers y el de core.provider_participants
--     comparten el MISMO id (aaf1f360-97c3-452d-b9ab-ca4cf0fa1956), así que al
--     borrar el de Flota nada queda huérfano: los 4 viajes del JDE, sus 43
--     sesiones de conductor y sus 92.583 posiciones GPS siguen resolviendo
--     contra la ficha de Proveedores, que es donde se administra su vehículo
--     (BUS GXVS17, 46 asientos) y sus tipos de cliente.
--   * La auto-asignación mejora: hoy, si la ficha de Flota estuviera en el
--     evento vigente, ganaría por el dedupe por id de fetchDriverProfiles y
--     Alex entraría al pool sin vehículo, sin capacidad y sin restricción de
--     tipo de cliente. Al borrarla queda solo la ficha buena.
--   * Se pierde su sesión de portal activa (tendrá que volver a entrar) y los
--     punteros a 2 fotos de jornada (30-08 y 18-09); los archivos siguen en el
--     bucket driver-photos.

begin;

-- 1) Repuntar el atleta del JDE a la disciplina de su propio evento.
--    (Benjamín Alarcón → Atletismo CONVENTIONAL/MIXED del JDE)
update core.athletes
   set discipline_id = 'fc577da0-2b3e-4d59-b84b-d11c4ec5094c'
 where id = 'c5ab80f3-21b3-47d6-b0df-fbbf640a645f';

-- 2) Borrar el evento de prueba. La cascada limpia disciplinas, delegaciones,
--    atletas, acreditaciones, vuelos, capacidades, chats, personal, vehículos,
--    la ficha de Flota de Alex y las 5.890 posiciones GPS del evento.
delete from core.events
 where id = '4cc259bc-fa73-4619-a0e0-b9a1bf3a5881';

commit;

-- Verificación posterior. Esperado: 1 evento, 16 disciplinas, 16 delegaciones,
-- 2 atletas, 4 viajes, 0 fichas en Flota, y el id de Alex resolviendo en
-- provider_participants (conductor_en_proveedores = 4).
select
  (select count(*) from core.events)                                   as eventos,
  (select count(*) from core.disciplines)                              as disciplinas,
  (select count(*) from core.delegations)                              as delegaciones,
  (select count(*) from core.athletes)                                 as atletas,
  (select count(*) from transport.trips)                               as viajes,
  (select count(*) from transport.drivers)                             as fichas_flota,
  (select count(*) from transport.trips t
     join core.provider_participants p on p.id = t.driver_id)          as conductor_en_proveedores;
