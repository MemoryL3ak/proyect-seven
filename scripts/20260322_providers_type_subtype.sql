-- Agrega columnas type y subtype a providers
alter table core.providers
  add column if not exists type    varchar(80),
  add column if not exists subtype varchar(100);

comment on column core.providers.type    is 'Tipo de proveedor (ej: Staff, Transporte, Salud…)';
comment on column core.providers.subtype is 'Sub-tipo dentro del tipo (ej: Jueces, Mesa de Control…)';
