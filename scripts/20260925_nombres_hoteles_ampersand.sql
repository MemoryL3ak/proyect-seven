-- 25-09-2026. Dos hoteles quedaron cargados con "§" donde va "&" (el
-- certificado del IND los nombra "Hotel LRH & Convention Center (ex Gala)" y
-- "Hippocampus Resort & Club"). El carácter ensuciaba los nombres en la app y
-- la búsqueda en el mapa. Se corrige el catálogo y el texto de los viajes.
-- Idempotente.
update logistics.accommodations set name = replace(name, '§', '&'), updated_at = now() where name like '%§%';
update transport.trips set origin = replace(origin, '§', '&') where origin like '%§%';
update transport.trips set destination = replace(destination, '§', '&') where destination like '%§%';
