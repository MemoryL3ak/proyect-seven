-- Carga de la planilla de coordinadores de hotel (Ariel, 22-09-2026).
--
-- OPCIONAL. Corre después de 20260922_hoteles_coordinadores.sql y sólo si
-- querés dejar cargada la planilla de una vez en vez de escribirla a mano en
-- el módulo Hoteles. Es reentrante: sólo toca los hoteles que todavía no
-- tienen coordinadores, así que volver a correrlo no pisa lo que se haya
-- editado después desde el panel.
--
-- Los nombres del `where` son los que están cargados en la base, que no son
-- los de la planilla: "Gala" es "Hotel LRH § Convention Center (ex Gala)",
-- "Novotel" es "Hotel Veranda (ex Novotel)", "Montecarlo" es "Hotel
-- Montecarlos". Si alguno se renombró, esa fila no va a calzar y ese hotel
-- queda sin cargar — revisá el conteo del final.
--
-- OJO: la planilla trae una fila "Magic" (Rafael, +56 9 5092 0358) que no
-- tiene hotel en la base. Si el hotel Magic se carga después, hay que ponerle
-- a Rafael a mano; acá no se puede.
--
-- Una misma persona cubre varios hoteles (Valeria en Ankara y Pullman;
-- Marcela y Javiera en Montecarlo, Mahia y Nilahue): se repite en cada uno, a
-- propósito, porque el contacto es del hotel.

update logistics.accommodations a
   set coordinators = v.contactos,
       updated_at = now()
  from (values
    ('Hotel Ankara',
     '[{"name":"Valeria","phone":"+56 9 8910 6266","role":"COORDINADOR","shift":null}]'::jsonb),
    ('Pullman Viña del Mar San Martin',
     '[{"name":"Valeria","phone":"+56 9 8910 6266","role":"COORDINADOR","shift":null}]'::jsonb),
    ('Hotel Bordeplaza',
     '[{"name":"Angelo","phone":"+56 9 8130 4166","role":"COORDINADOR","shift":null}]'::jsonb),
    ('Hotel Bosque de Reñaca',
     '[{"name":"Rodrigo","phone":"+56 9 5873 5979","role":"COORDINADOR","shift":null}]'::jsonb),
    ('Hotel Diego de Almagro',
     '[{"name":"Vania","phone":"+56 9 9320 0572","role":"COORDINADOR","shift":null}]'::jsonb),
    ('Hotel LRH § Convention Center (ex Gala)',
     '[{"name":"Cristian","phone":"+56 9 5657 7244","role":"COORDINADOR","shift":null},
       {"name":"Francisco","phone":null,"role":"APOYO","shift":"TODO_EL_DIA"},
       {"name":"Etienne","phone":null,"role":"APOYO","shift":"TODO_EL_DIA"},
       {"name":"María José","phone":null,"role":"APOYO","shift":"PM"}]'::jsonb),
    ('Hippocampus Resort § Club',
     '[{"name":"Araceli","phone":"+56 9 5547 6717","role":"COORDINADOR","shift":null},
       {"name":"Felipe","phone":"+56 9 6677 8327","role":"COORDINADOR","shift":null}]'::jsonb),
    ('Mantagua Village',
     '[{"name":"Bárbara","phone":"+56 9 7404 9560","role":"COORDINADOR","shift":null},
       {"name":"Rafael","phone":"+56 9 5092 0358","role":"COORDINADOR","shift":null}]'::jsonb),
    ('Best Western Marina del Rey',
     '[{"name":"Giordana","phone":"+56 9 3389 0321","role":"COORDINADOR","shift":null},
       {"name":"Jorge","phone":null,"role":"APOYO","shift":"TODO_EL_DIA"},
       {"name":"Tomás","phone":null,"role":"APOYO","shift":"PM"}]'::jsonb),
    ('Marina Dunas',
     '[{"name":"Beatriz","phone":"+56 9 9837 0527","role":"COORDINADOR","shift":null},
       {"name":"Maximiliano","phone":"+56 9 3955 2469","role":"COORDINADOR","shift":null}]'::jsonb),
    ('Hotel Montecarlos',
     '[{"name":"Marcela","phone":"+56 9 9100 8098","role":"COORDINADOR","shift":null},
       {"name":"Javiera","phone":"+56 9 8730 8831","role":"COORDINADOR","shift":null}]'::jsonb),
    ('Mahia Beach Hotel',
     '[{"name":"Marcela","phone":"+56 9 9100 8098","role":"COORDINADOR","shift":null},
       {"name":"Javiera","phone":"+56 9 8730 8831","role":"COORDINADOR","shift":null}]'::jsonb),
    ('Hotel Nilahue',
     '[{"name":"Marcela","phone":"+56 9 9100 8098","role":"COORDINADOR","shift":null},
       {"name":"Javiera","phone":"+56 9 8730 8831","role":"COORDINADOR","shift":null}]'::jsonb),
    ('Hotel Veranda (ex Novotel)',
     '[{"name":"Javier","phone":"+56 9 4805 0155","role":"COORDINADOR","shift":null}]'::jsonb)
  ) as v(nombre, contactos)
 where a.name = v.nombre
   and a.coordinators = '[]'::jsonb;

-- Control: deberían quedar 14 hoteles con coordinadores y ninguno sin ellos.
-- Si algún hotel aparece en la segunda lista, es que su nombre cambió.
select count(*) filter (where coordinators <> '[]'::jsonb) as con_coordinadores,
       count(*) filter (where coordinators =  '[]'::jsonb) as sin_coordinadores
  from logistics.accommodations;

select name as hotel_sin_coordinadores
  from logistics.accommodations
 where coordinators = '[]'::jsonb
 order by name;
