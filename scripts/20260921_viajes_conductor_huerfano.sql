-- Viajes que apuntan a un conductor que ya no existe.
--
-- Al eliminar el evento de prueba "Juegos Panamericanos 2026" se fue con él la
-- ficha de Flota de Alex Arevalo (aaf1f360-97c3-452d-b9ab-ca4cf0fa1956).
-- Cuatro viajes antiguos, del 18-09, siguen con ese driver_id: transport.trips
-- no tiene FK hacia el conductor, así que nadie los detuvo.
--
-- El efecto visible: el Panel Conductores los agrupa bajo un conductor que no
-- puede nombrar, y mostraba el final del uuid ("f0fa1956") como si fuera un
-- nombre. Esa parte ya está corregida en la interfaz; esto limpia el dato.
--
-- Son los cuatro viajes JEFE_MISION con trip_date en nulo, todos en
-- DROPPED_OFF. Elegí UNA de las dos opciones de abajo.

-- ───────────────────────────────────────────────────────────────────────────
-- OPCIÓN A — Reasignarlos a la ficha vigente de Alex Arevalo.
-- Conserva el historial: son sus viajes, sólo que su ficha se recreó con otro
-- id (add61e36-6fa0-4108-a654-2a42d4dc97e1, la de Registro → Proveedores).
-- ───────────────────────────────────────────────────────────────────────────
update transport.trips
   set driver_id = 'add61e36-6fa0-4108-a654-2a42d4dc97e1'
 where driver_id = 'aaf1f360-97c3-452d-b9ab-ca4cf0fa1956';

-- ───────────────────────────────────────────────────────────────────────────
-- OPCIÓN B — Borrarlos. Son viajes de prueba del 18-09, sin fecha operativa.
-- Descomentar sólo si se prefiere esto en vez de la opción A.
-- ───────────────────────────────────────────────────────────────────────────
-- delete from transport.trips
--  where driver_id = 'aaf1f360-97c3-452d-b9ab-ca4cf0fa1956';

-- Verificación: debe devolver 0 filas.
select count(*)::int as viajes_con_conductor_inexistente
  from transport.trips t
 where t.driver_id is not null
   and not exists (select 1 from transport.drivers d where d.id = t.driver_id)
   and not exists (select 1 from core.provider_participants p where p.id = t.driver_id);
