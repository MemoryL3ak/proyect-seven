-- Nombres de participantes escritos como nombres propios.
--
-- Las nóminas llegan de dieciséis regiones en planillas distintas, y cada una
-- escribe como puede: "JUAN PEREZ SOTO" en mayúsculas, "francisco nuñez" en
-- minúsculas, "Francisco NUñez Espinoza" con el Bloq Mayús a medio apretar.
-- Ese texto no se queda en la planilla: sale impreso en la credencial, en el
-- listado del Jefe de Misión y en los correos con el código de acceso.
--
-- El script deja una función y la aplica. La función existe porque esto no
-- pasa una sola vez: cada región que carga su nómina vuelve a traer el
-- problema, así que el script se puede volver a correr entero cuantas veces
-- haga falta y sólo toca las filas que están mal.
--
-- La regla: primera letra en mayúscula, el resto en minúscula, una palabra a
-- la vez. Con tres detalles que un "capitalizar cada palabra" ingenuo se come:
--
--   * las partículas van en minúscula cuando no abren el nombre, que es como
--     se escriben en castellano: "Juan de la Cruz", no "Juan De La Cruz". Si
--     abren el nombre sí llevan mayúscula: "De la Cruz, Juan".
--   * después de un guion o un apóstrofo vuelve a empezar la palabra:
--     "Ana-María", "O'Higgins". initcap() de Postgres respeta el guion pero
--     no el apóstrofo —devuelve "O'higgins"—, por eso no se usa.
--   * los espacios de más se van: " juan  pérez " queda "Juan Pérez".
--
-- Lo que la función NO puede adivinar, y conviene saber antes de correrla:
-- un apellido que de verdad lleva mayúscula adentro —"McKenna", "DiCaprio"—
-- queda "Mckenna", "Dicaprio". Son excepciones raras en una nómina escolar
-- chilena; si aparece alguna, se corrige a mano después y la función no la
-- vuelve a tocar salvo que se corra de nuevo.

-- ---------------------------------------------------------------------------
-- 1. La función
-- ---------------------------------------------------------------------------

create or replace function core.nombre_propio(texto text) returns text
language plpgsql immutable strict as $fn$
declare
  -- Minúscula cuando no abren el nombre. No entran "e" ni "i" a propósito:
  -- se confundirían con una inicial del segundo nombre.
  particulas constant text[] := array[
    'de', 'del', 'la', 'las', 'los', 'y',
    'da', 'das', 'do', 'dos', 'van', 'von', 'der', 'di', 'du'
  ];
  palabras text[];
  palabra  text;
  letra    text;
  abre     boolean;
  armada   text;
  salida   text := '';
  i int;
  j int;
begin
  -- Espacios de sobra fuera: al inicio, al final y los dobles del medio.
  palabras := regexp_split_to_array(btrim(regexp_replace(texto, '\s+', ' ', 'g')), ' ');

  for i in 1 .. coalesce(array_length(palabras, 1), 0) loop
    palabra := palabras[i];
    continue when palabra = '';

    if i > 1 and lower(palabra) = any (particulas) then
      armada := lower(palabra);
    else
      armada := '';
      abre   := true;
      for j in 1 .. length(palabra) loop
        letra  := substr(palabra, j, 1);
        armada := armada || case when abre then upper(letra) else lower(letra) end;
        -- Tras un guion o un apóstrofo empieza otra palabra.
        abre   := letra in ('-', '''');
      end loop;
    end if;

    salida := case when salida = '' then armada else salida || ' ' || armada end;
  end loop;

  return salida;
end
$fn$;

comment on function core.nombre_propio(text) is
  'Escribe un nombre de persona como nombre propio: inicial mayúscula, resto minúscula, partículas ("de", "la", "van") en minúscula salvo que abran el nombre, y mayúscula después de guion o apóstrofo. Idempotente.';

-- ---------------------------------------------------------------------------
-- 2. Qué va a cambiar (mirar antes de aplicar)
-- ---------------------------------------------------------------------------
-- Esta consulta no modifica nada: lista las filas que el update de abajo va a
-- tocar, con el antes y el después al lado. Conviene leerla completa la
-- primera vez —son pocas— y confirmar que no hay ningún apellido con
-- mayúscula interna legítima antes de seguir.

select full_name as antes,
       core.nombre_propio(full_name) as despues
  from core.athletes
 where full_name is not null
   and full_name <> core.nombre_propio(full_name)
 order by 1;

-- ---------------------------------------------------------------------------
-- 3. Aplicar
-- ---------------------------------------------------------------------------
-- Sólo las filas que están mal: las que ya estaban bien no se tocan, así que
-- updated_at no se mueve por gusto y correr el script de nuevo no hace nada.
-- Incluye las fichas en estado DELETED: si alguna se restaura, vuelve con el
-- nombre bien escrito.

update core.athletes
   set full_name  = core.nombre_propio(full_name),
       updated_at = now()
 where full_name is not null
   and full_name <> core.nombre_propio(full_name);

-- ---------------------------------------------------------------------------
-- 4. Opcionales
-- ---------------------------------------------------------------------------

-- 4.a) El personal de los proveedores (choferes, apoyo) sale de las mismas
-- planillas y tiene el mismo problema. No son participantes del evento, por
-- eso va aparte: descomentar si se quiere dejar parejo.
--
-- update core.provider_participants
--    set full_name = core.nombre_propio(full_name)
--  where full_name is not null
--    and full_name <> core.nombre_propio(full_name);

-- 4.b) Dejarlo resuelto para siempre, en vez de acordarse de correr el script
-- después de cada carga. El trigger normaliza al insertar y al actualizar, así
-- que ninguna nómina nueva vuelve a entrar en mayúsculas.
--
-- El costo: nadie puede guardar un nombre con mayúscula interna a propósito
-- —"McKenna" se guardaría "Mckenna" aunque se escriba bien en el formulario—
-- porque el trigger pasa por encima. Por eso queda comentado: es una decisión,
-- no un detalle técnico.
--
-- create or replace function core.athletes_nombre_propio() returns trigger
-- language plpgsql as $tg$
-- begin
--   if new.full_name is not null then
--     new.full_name := core.nombre_propio(new.full_name);
--   end if;
--   return new;
-- end
-- $tg$;
--
-- drop trigger if exists athletes_nombre_propio on core.athletes;
-- create trigger athletes_nombre_propio
--   before insert or update of full_name on core.athletes
--   for each row execute function core.athletes_nombre_propio();
