-- Coordinadores de hotel.
--
-- El portal ya tenía dónde mostrar "Contacto del hotel" —la tarjeta de
-- hotelería y la del Coordinador de Comité lo pintan— pero leía un campo
-- `contactPhone` que no existe ni en la tabla ni en la API: el bloque nunca
-- se dibujó y el teléfono del hotel se preguntaba por fuera del sistema.
--
-- La planilla de operaciones no trae *un* coordinador por hotel, así que una
-- columna suelta (como coordinator_name/coordinator_phone en las sedes) no
-- alcanza:
--   * hay hoteles con dos coordinadores (Hippocampus, Mantagua, Marina Dunas,
--     Montecarlo/Mahia/Nilahue);
--   * una misma persona cubre varios hoteles (Valeria en Ankara y Pullman);
--   * y hay gente de apoyo con turno: "Francisco (all day)", "María José (pm)".
--
-- Se guarda la lista completa en jsonb, igual que room_inventory en esta misma
-- tabla. Cada elemento:
--   { "name": "Valeria", "phone": "+56 9 8910 6266",
--     "role": "COORDINADOR" | "APOYO",
--     "shift": "TODO_EL_DIA" | "AM" | "PM" | null }
--
-- El turno sólo se usa en el apoyo, que es donde la planilla lo anota; en el
-- coordinador va null.

alter table logistics.accommodations
  add column if not exists coordinators jsonb not null default '[]'::jsonb;

comment on column logistics.accommodations.coordinators is
  'Coordinadores y apoyos del hotel: [{name, phone, role: COORDINADOR|APOYO, shift: TODO_EL_DIA|AM|PM|null}]. Vacío = sin contacto cargado.';
