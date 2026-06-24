-- ============================================================================
--  Seed de PRUEBAS para el módulo Deportes (Planificación deportiva)
-- ----------------------------------------------------------------------------
--  Las "pruebas" son filas de core.disciplines que cuelgan de un deporte padre
--  (parent_id) y tienen scheduled_at + venue_name. Este script recorre TODOS los
--  deportes raíz del evento indicado y, por cada uno, crea un set de pruebas
--  (Clasificatoria x2, Semifinal, Final) con fechas escalonadas.
--
--  - Re-ejecutable: no duplica (usa NOT EXISTS por deporte + nombre + fecha).
--  - Hereda category/gender del deporte padre (con valores por defecto).
--  - Editá las variables del bloque CONFIG abajo y corré el script completo.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- para gen_random_uuid()

WITH config AS (
  SELECT
    'Juegos Panamericanos 2026'::text AS evento,          -- nombre del evento
    DATE '2026-04-08'                  AS fecha_base,      -- primer día de pruebas
    'Estadio Claro Arena'::text        AS sede_default     -- recinto por defecto
),
ev AS (
  SELECT e.id, c.fecha_base, c.sede_default
  FROM core.events e
  CROSS JOIN config c
  WHERE e.name = c.evento
  LIMIT 1
),
-- Deportes raíz del evento (parent_id IS NULL), numerados para escalonar fechas
deportes AS (
  SELECT
    d.id, d.name, d.event_id, d.category, d.gender,
    ROW_NUMBER() OVER (ORDER BY d.name) - 1 AS rn
  FROM core.disciplines d
  JOIN ev ON d.event_id = ev.id
  WHERE d.parent_id IS NULL
),
-- Plantilla de fases por deporte: (nombre de fase, día relativo, hora)
plantilla(fase, dia, hora) AS (
  VALUES
    ('Clasificatoria'::text, 0, '10:00'::time),
    ('Clasificatoria'::text, 1, '10:00'::time),
    ('Semifinal'::text,      2, '18:00'::time),
    ('Final'::text,          3, '20:00'::time)
)
INSERT INTO core.disciplines
  (id, name, event_id, category, gender, parent_id, scheduled_at, venue_name)
SELECT
  gen_random_uuid(),
  -- nombre único: incluye la fase y la fecha (la tabla exige name único por evento/categoría/género)
  s.name || ' - ' || p.fase || ' ' || to_char((ev.fecha_base + (s.rn + p.dia)::int), 'DD/MM'),
  s.event_id,
  COALESCE(s.category, 'CONVENTIONAL'),
  COALESCE(s.gender, 'MALE'),
  s.id,
  ((ev.fecha_base + (s.rn + p.dia)::int) + p.hora)::timestamptz,  -- cada deporte arranca 1 día después
  ev.sede_default
FROM deportes s
CROSS JOIN plantilla p
CROSS JOIN ev
-- Re-ejecutable: si el nombre ya existe para ese evento/categoría/género, lo ignora
ON CONFLICT ON CONSTRAINT disciplines_name_event_category_gender_key DO NOTHING;

-- Verificación: cuántas pruebas quedaron por deporte
SELECT pad.name AS deporte, COUNT(*) AS pruebas
FROM core.disciplines hijo
JOIN core.disciplines pad ON pad.id = hijo.parent_id
JOIN core.events e ON e.id = hijo.event_id
WHERE e.name = 'Juegos Panamericanos 2026'
  AND hijo.scheduled_at IS NOT NULL
GROUP BY pad.name
ORDER BY pad.name;
