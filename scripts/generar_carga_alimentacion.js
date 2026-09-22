// Genera el script de carga de alimentación a partir de los tres CSV.
// Las planillas viven en scripts/datos-alimentacion/. Correlo con:
//   node scripts/generar_carga_alimentacion.js
const fs = require('fs');
const path = require('path');

const AQUI = path.join(__dirname, 'datos-alimentacion');
const SALIDA = path.join(__dirname, '20260922_alimentacion_carga.sql');

/** "22-09" -> "2026-09-22". El evento va del 22-09-2026 al 04-10-2026. */
function aISO(ddmm) {
  const [dia, mes] = ddmm.split('-');
  return `2026-${mes}-${dia}`;
}

const esc = (s) => String(s).replace(/'/g, "''");

function leerCsv(nombre) {
  return fs
    .readFileSync(path.join(AQUI, nombre), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.length > 0)
    .map((l) => l.split(';'));
}

// ── Almuerzo y cena ────────────────────────────────────────────────────────
// La fecha y el servicio sólo vienen en la primera fila de cada bloque; el
// resto los hereda. Los platos se juntan por categoría, que es la decisión de
// producto: una entrada por categoría, con los platos en la descripción.
const filas = leerCsv('almuerzo-cena.csv').slice(1);
const servicios = new Map(); // "fecha|servicio" -> Map(categoria -> [texto])
let fechaActual = '';
let servicioActual = '';
const ORDEN_CAT = ['Ensaladas', 'Fondo', 'Postres'];

for (const [fecha, servicio, categoria, detalle, observaciones] of filas) {
  if (fecha && fecha.trim()) fechaActual = fecha.trim();
  if (servicio && servicio.trim()) servicioActual = servicio.trim();
  if (!detalle || !detalle.trim()) continue;
  const clave = `${fechaActual}|${servicioActual}`;
  if (!servicios.has(clave)) servicios.set(clave, new Map());
  const porCategoria = servicios.get(clave);
  const cat = categoria.trim();
  if (!porCategoria.has(cat)) porCategoria.set(cat, []);
  const obs = (observaciones ?? '').trim();
  // El gramaje va entre paréntesis pegado al plato: es del plato, no del día.
  porCategoria.get(cat).push(obs ? `${detalle.trim()} (${obs})` : detalle.trim());
}

const TITULO_CAT = { Ensaladas: 'Ensaladas', Fondo: 'Fondos', Postres: 'Postres' };

const valoresMenu = [];
for (const [clave, porCategoria] of servicios) {
  const [fecha, servicio] = clave.split('|');
  const cats = [...porCategoria.keys()].sort(
    (a, b) => ORDEN_CAT.indexOf(a) - ORDEN_CAT.indexOf(b),
  );
  for (const cat of cats) {
    valoresMenu.push(
      `  ('${aISO(fecha)}', '${servicio}', '${esc(TITULO_CAT[cat] ?? cat)}', '${esc(
        porCategoria.get(cat).join(' · '),
      )}')`,
    );
  }
}

// ── Desayuno ───────────────────────────────────────────────────────────────
// Oferta fija: las mismas seis categorías todos los días. Se repite por fecha
// porque el portal arma el menú del día filtrando food_menus por fecha.
const desayuno = leerCsv('desayuno.csv');
const catsDesayuno = desayuno[0].map((c) => c.trim());

/**
 * En la planilla, las filas que empiezan con guión son variedades de lo de
 * arriba: "Pan Blanco/Integral" y debajo "- Marraqueta", "- Hallullas". En
 * una lista corrida se leían como tres panes sueltos con un guión adelante,
 * así que se pliegan sobre el ítem al que pertenecen.
 */
const plegarSubitems = (items) => {
  const salida = [];
  for (const item of items) {
    if (!item.startsWith('-')) {
      salida.push(item);
      continue;
    }
    const sub = item.replace(/^-\s*/, '');
    if (salida.length === 0) {
      salida.push(sub);
      continue;
    }
    const ultimo = salida[salida.length - 1];
    salida[salida.length - 1] = ultimo.endsWith(')')
      ? `${ultimo.slice(0, -1)}, ${sub})`
      : `${ultimo} (${sub})`;
  }
  return salida;
};

const itemsDesayuno = catsDesayuno.map((_, col) =>
  plegarSubitems(
    desayuno
      .slice(1)
      .map((fila) => (fila[col] ?? '').trim())
      .filter(Boolean),
  ),
);

// El desayuno no se sirve el 22-09 (día de llegada: el menú sólo trae cena) y
// sí el 04-10 (día de salida: los bloques horarios traen su extensión).
const DIAS_DESAYUNO = [];
for (let d = 23; d <= 30; d++) DIAS_DESAYUNO.push(`2026-09-${String(d).padStart(2, '0')}`);
for (let d = 1; d <= 4; d++) DIAS_DESAYUNO.push(`2026-10-0${d}`);

for (const fecha of DIAS_DESAYUNO) {
  catsDesayuno.forEach((cat, i) => {
    if (itemsDesayuno[i].length === 0) return;
    valoresMenu.push(
      `  ('${fecha}', 'DESAYUNO', '${esc(cat)}', '${esc(itemsDesayuno[i].join(' · '))}')`,
    );
  });
}

// ── Bloques horarios ───────────────────────────────────────────────────────
const bloques = leerCsv('bloques.csv').slice(1);
const NOMBRE_COMIDA = {
  DESAYUNO: 'DESAYUNO',
  ALMUERZO: 'ALMUERZO',
  'COLACIÓN': 'COLACION',
  CENA: 'CENA',
};
const valoresBloques = [];
for (const [rotulo, fecha, inicio, fin] of bloques) {
  const etiqueta = (rotulo ?? '').trim();
  if (!etiqueta) continue;
  const esGeneral = (fecha ?? '').trim().toLowerCase() === 'general';
  const comida = esGeneral
    ? NOMBRE_COMIDA[etiqueta.toUpperCase()]
    : NOMBRE_COMIDA[etiqueta.split('-')[0].trim().toUpperCase()];
  if (!comida) throw new Error(`Comida desconocida: ${etiqueta}`);
  const cuando = esGeneral ? 'null' : `'${aISO(fecha.trim())}'`;
  // El null va tipado: en un VALUES, una columna que arranca con null sin
  // tipo obliga a Postgres a deducirlo de las filas siguientes.
  const nota = esGeneral ? 'null::text' : `'Extensión excepcional'`;
  valoresBloques.push(
    `  ('${comida}', ${cuando}::date, '${inicio.trim()}'::time, '${fin.trim()}'::time, ${nota})`,
  );
}

// ── SQL ────────────────────────────────────────────────────────────────────
const sql = `-- Carga de la alimentación del evento (planillas de Ariel, 22-09-2026).
--
-- GENERADO. Sale de tres planillas: "Almuerzo y Cena", "Desayuno" y
-- "Bloques Horarios". Si cambian, conviene regenerarlo antes que editarlo a
-- mano, para que el archivo siga calzando con la planilla.
--
-- Corre después de 20260922_bloques_horarios_comida.sql.
--
-- Decisiones de la carga:
--  * Una entrada por categoría y no por plato: "Ensaladas", "Fondos" y
--    "Postres" con sus platos en la descripción. El modelo no tiene columna
--    de categoría y así el menú se lee agrupado sin tocar el esquema.
--  * El gramaje de la planilla ("Ganso 200 grs.") va entre paréntesis pegado
--    al plato: es del plato y no del día.
--  * Sin hotel ni tipo de cliente: el menú es el mismo para los dos comedores
--    y para todos los participantes. Vacío = lo ve todo el mundo.
--  * El desayuno es la misma oferta todos los días y se repite por fecha,
--    porque el portal arma el menú del día filtrando por fecha. No se carga
--    el 22-09 (día de llegada, la planilla sólo trae cena) y sí el 04-10
--    (día de salida, los bloques traen su extensión de desayuno).
--
-- Es reentrante: borra primero lo del rango del evento y vuelve a insertar,
-- así correrlo dos veces no duplica.

begin;

-- ── Menús ─────────────────────────────────────────────────────────────────
delete from logistics.food_menus
 where date between '2026-09-22' and '2026-10-04';

insert into logistics.food_menus (date, meal_type, title, description)
values
${valoresMenu.join(',\n')};

-- ── Bloques horarios ──────────────────────────────────────────────────────
delete from logistics.meal_time_blocks
 where event_id = (select id from core.events where name like 'Final Nacional sub 14%' limit 1);

insert into logistics.meal_time_blocks (event_id, meal_type, date, starts_at, ends_at, note)
select e.id, v.meal_type, v.date, v.starts_at, v.ends_at, v.note
  from (select id from core.events where name like 'Final Nacional sub 14%' limit 1) e
 cross join (values
${valoresBloques.join(',\n')}
 ) as v(meal_type, date, starts_at, ends_at, note);

commit;

-- Control: 25 servicios de almuerzo/cena (3 filas cada uno) + 12 días de
-- desayuno (6 filas cada uno), y 14 bloques horarios.
select meal_type, count(*)::int as filas, count(distinct date)::int as dias
  from logistics.food_menus group by meal_type order by meal_type;

select meal_type,
       count(*) filter (where date is null)::int as general,
       count(*) filter (where date is not null)::int as extensiones
  from logistics.meal_time_blocks group by meal_type order by meal_type;
`;

fs.writeFileSync(SALIDA, sql, 'utf8');
console.log(`escrito: ${SALIDA}`);
console.log(`servicios almuerzo/cena: ${servicios.size}`);
console.log(`filas de menú: ${valoresMenu.length}`);
console.log(`  desayuno: ${DIAS_DESAYUNO.length} días × ${catsDesayuno.filter((_, i) => itemsDesayuno[i].length).length} categorías`);
console.log(`bloques horarios: ${valoresBloques.length}`);
