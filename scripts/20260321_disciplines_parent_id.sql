-- Agrega columna parent_id a disciplines para soportar jerarquía deporte → prueba
alter table core.disciplines
  add column if not exists parent_id uuid references core.disciplines(id) on delete set null;

comment on column core.disciplines.parent_id is
  'UUID del deporte padre. NULL = deporte raíz. Poblado = prueba/subdisciplina.';
