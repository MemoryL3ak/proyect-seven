-- Notas de equipaje de la ficha (28-09-2026).
--
-- El servidor escribe core.athletes.luggage_notes (el resumen de equipaje que
-- arma el formulario de AND: "1 bolso, 2 maleta 23, Sobreequipaje: Sí"), pero
-- la columna nunca se creó en la base. Guardar una ficha de AND con algún dato
-- de equipaje respondía "Internal server error" (World Rugby: las fichas traen
-- "Sobreequipaje: No/Sí" desde la planilla).

alter table core.athletes
  add column if not exists luggage_notes text;
