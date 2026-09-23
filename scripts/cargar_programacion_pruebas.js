// Carga una programación oficial (partidos de un deporte) como pruebas del
// catálogo, enlazadas a la disciplina, la sede y las dos delegaciones.
//
// Uso:
//   node scripts/cargar_programacion_pruebas.js scripts/programacion/futsal-s14-2026-09.csv           (sólo muestra el cruce)
//   node scripts/cargar_programacion_pruebas.js scripts/programacion/futsal-s14-2026-09.csv --aplicar (inserta / actualiza)
//
// CSV separado por ";" con cabecera:
//   deporte;genero;jornada;partido;grupo;delegacion_1;delegacion_2;dia;salida_hotel;hora;retorno_hotel;recinto
// "dia" va como en la programación ("23-sept"); el año se toma del evento.
// Las horas son de Chile (America/Santiago).
//
// Es idempotente: cada fila lleva metadata.fixtureKey (deporte-género-jornada-
// partido); si ya existe una prueba con esa clave se actualiza, no se duplica.
// Cada prueba deja su evento en core.sports_calendar_events igual que lo hace
// el API (src/disciplines/prueba-calendario.ts).
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const env = {};
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const archivo = process.argv[2];
const aplicar = process.argv.includes('--aplicar');
if (!archivo) {
  console.error('Falta el CSV. Uso: node scripts/cargar_programacion_pruebas.js <archivo.csv> [--aplicar]');
  process.exit(1);
}

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’.]/g, '')
    .toLowerCase()
    .trim();

/** Alias que usa la programación para los recintos → parte del nombre en Sedes. */
const ALIAS_RECINTO = {
  uvm: 'universidad vina del mar',
  'utfsm vina': 'utfsm',
  'polideportivo vina': 'polideportivo vina del mar',
  'nicolas massu': 'nicolas massu',
};

const GENERO = { femenino: 'FEMALE', masculino: 'MALE', mixto: 'MIXED', f: 'FEMALE', m: 'MALE' };
const MESES = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, sept: 8, oct: 9, nov: 10, dic: 11 };

/** "Región del Maule" → "Maule" (misma regla que frontend/lib/pruebas.ts). */
function nombreCortoRegion(nombre) {
  const sin = String(nombre ?? '').trim().replace(/^regi[oó]n\s+(de\s+la|del|de)\s+/i, '').replace(/^regi[oó]n\s+/i, '');
  if (/^ays[eé]n\b/i.test(sin)) return 'Aysén';
  if (/^magallanes\b/i.test(sin)) return 'Magallanes';
  if (/^libertador\b.*o'?higgins/i.test(sin)) return "O'Higgins";
  if (/^metropolitana\b/i.test(sin)) return 'Metropolitana';
  if (/^arica\b/i.test(sin)) return 'Arica y Parinacota';
  return sin;
}

/** Hora local de Chile → ISO UTC, calculando el desfase real de esa fecha. */
function aUtc(anio, mes, dia, hora, minuto) {
  const guess = Date.UTC(anio, mes, dia, hora, minuto);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
  const local = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return new Date(guess - (local - guess)).toISOString();
}

function leerCsv(ruta) {
  const lineas = fs.readFileSync(ruta, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const cab = lineas[0].split(';').map((h) => h.trim());
  return lineas.slice(1).map((l, i) => {
    const celdas = l.split(';');
    const fila = {};
    cab.forEach((h, j) => (fila[h] = (celdas[j] ?? '').trim()));
    fila._linea = i + 2;
    return fila;
  });
}

function unico(lista, que, texto) {
  if (lista.length === 1) return lista[0];
  if (lista.length === 0) throw new Error(`${que} "${texto}" no está en el catálogo`);
  throw new Error(`${que} "${texto}" calza con varias: ${lista.map((x) => x.name || x.nombre).join(' / ')}`);
}

(async () => {
  const db = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  try {
    const cols = await db.query(
      "select column_name from information_schema.columns where table_schema='core' and table_name='disciplines' and column_name in ('delegation_ids','metadata')",
    );
    if (cols.rowCount < 2) throw new Error('Falta correr scripts/20260923_pruebas_delegaciones.sql (delegation_ids / metadata en core.disciplines)');

    const eventos = (await db.query('select id, name, start_date, end_date from core.events order by start_date desc')).rows;
    const disciplinas = (await db.query('select id, name, event_id, gender, parent_id from core.disciplines')).rows;
    const sedes = (await db.query("select id, name, event_id from logistics.venues where coalesce(venue_type,'SEDE') = 'SEDE'")).rows;
    const delegaciones = (await db.query('select id, event_id, country_code, metadata from core.delegations')).rows.map((d) => ({
      ...d,
      nombre: (d.metadata && d.metadata.name) || d.country_code,
    }));

    const filas = leerCsv(archivo);
    const resueltas = [];
    const errores = [];
    for (const f of filas) {
      try {
        const genero = GENERO[norm(f.genero)];
        if (!genero) throw new Error(`género "${f.genero}" no reconocido`);
        const padres = disciplinas.filter((d) => !d.parent_id && norm(d.name) === norm(f.deporte) && d.gender === genero);
        const padre = unico(padres, 'Disciplina', `${f.deporte} ${f.genero}`);
        const evento = eventos.find((e) => e.id === padre.event_id) || eventos[0];
        if (!evento) throw new Error('no hay evento');

        const [diaTxt, mesTxt] = f.dia.split(/[-\/ ]/);
        const mes = MESES[norm(mesTxt).slice(0, 4)] ?? MESES[norm(mesTxt).slice(0, 3)];
        if (mes === undefined) throw new Error(`mes "${mesTxt}" no reconocido`);
        const anio = new Date(evento.start_date).getUTCFullYear();
        const hhmm = (s) => {
          const m = String(s).match(/^(\d{1,2}):(\d{2})$/);
          if (!m) throw new Error(`hora "${s}" inválida`);
          return aUtc(anio, mes, +diaTxt, +m[1], +m[2]);
        };

        const claveRecinto = norm(f.recinto);
        const buscado = ALIAS_RECINTO[claveRecinto] || claveRecinto;
        const candidatas = sedes.filter((v) => (!v.event_id || v.event_id === evento.id) && norm(v.name).includes(buscado));
        const sede = unico(candidatas, 'Sede', f.recinto);

        const delegacionDe = (texto) => {
          // "Arica y P." → "arica"; "Los Lagos" se busca entero (no por palabra:
          // "los" calza con Los Lagos, Los Ríos y Aysén ... del Campo).
          const token = norm(texto).split(/\s+y\s+/)[0].trim();
          const cand = delegaciones.filter((d) => (!d.event_id || d.event_id === evento.id) && norm(d.nombre).includes(token));
          return unico(cand, 'Delegación', texto);
        };
        const d1 = delegacionDe(f.delegacion_1);
        const d2 = delegacionDe(f.delegacion_2);

        const fixtureKey = `${norm(f.deporte)}-${genero.toLowerCase()}-j${f.jornada}-p${f.partido}`;
        resueltas.push({
          fila: f,
          padre,
          evento,
          sede,
          d1,
          d2,
          fixtureKey,
          name: `Fecha ${f.jornada} · P${f.partido} · Grupo ${f.grupo} · ${nombreCortoRegion(d1.nombre)} vs ${nombreCortoRegion(d2.nombre)}`,
          scheduledAt: hhmm(f.hora),
          metadata: {
            fixtureKey,
            round: Number(f.jornada),
            matchNumber: Number(f.partido),
            group: f.grupo,
            hotelDepartureAt: f.salida_hotel ? hhmm(f.salida_hotel) : null,
            hotelReturnAt: f.retorno_hotel ? hhmm(f.retorno_hotel) : null,
            source: path.basename(archivo),
          },
        });
      } catch (e) {
        errores.push(`línea ${f._linea}: ${e.message}`);
      }
    }

    for (const r of resueltas) {
      console.log(
        [r.fila.deporte, r.fila.genero, r.name, r.scheduledAt, r.sede.name, r.d1.country_code, r.d2.country_code].join(' | '),
      );
    }
    console.log(`\n${resueltas.length} filas resueltas, ${errores.length} con error`);
    errores.forEach((e) => console.log('  ✗ ' + e));
    if (errores.length) process.exitCode = 1;
    if (!aplicar) {
      console.log('\nSin --aplicar no se escribe nada.');
      return;
    }
    if (errores.length) {
      console.log('\nCon errores no se aplica nada.');
      return;
    }

    let insertadas = 0;
    let actualizadas = 0;
    await db.query('begin');
    for (const r of resueltas) {
      const existente = await db.query(
        "select id from core.disciplines where parent_id = $1 and metadata->>'fixtureKey' = $2",
        [r.padre.id, r.fixtureKey],
      );
      const valores = [r.name, r.padre.event_id, 'CONVENTIONAL', r.padre.gender, r.padre.id, r.scheduledAt, r.sede.name, [r.d1.id, r.d2.id], JSON.stringify(r.metadata)];
      let id;
      if (existente.rowCount) {
        id = existente.rows[0].id;
        await db.query(
          `update core.disciplines set name=$1, event_id=$2, category=$3, gender=$4, parent_id=$5, scheduled_at=$6, venue_name=$7, delegation_ids=$8::uuid[], metadata=$9::jsonb where id=$10`,
          [...valores, id],
        );
        actualizadas += 1;
      } else {
        const ins = await db.query(
          `insert into core.disciplines (name, event_id, category, gender, parent_id, scheduled_at, venue_name, delegation_ids, metadata)
           values ($1,$2,$3,$4,$5,$6,$7,$8::uuid[],$9::jsonb) returning id`,
          valores,
        );
        id = ins.rows[0].id;
        insertadas += 1;
      }
      // Mismo evento de calendario que genera el API (prueba-calendario.ts).
      const nombres = [r.d1.nombre, r.d2.nombre];
      const metaCal = JSON.stringify({
        ...r.metadata,
        title: `🏁 ${r.name}`,
        scheduleType: 'COMPETITION',
        disciplineId: id,
        parentDisciplineId: r.padre.id,
        category: 'CONVENTIONAL',
        gender: r.padre.gender,
        delegationNames: nombres,
      });
      const externalId = `prueba:${id}`;
      const cal = await db.query('select id from core.sports_calendar_events where external_id = $1', [externalId]);
      const calValores = [r.padre.event_id, r.padre.name, 'Pruebas', nombres[0], nombres[1], r.sede.name, r.scheduledAt, 'SCHEDULED', externalId, 'PRUEBAS', [r.d1.id, r.d2.id], metaCal];
      if (cal.rowCount) {
        await db.query(
          `update core.sports_calendar_events set event_id=$1, sport=$2, league=$3, home_team=$4, away_team=$5, venue=$6, start_at_utc=$7, status=$8, external_id=$9, source=$10, delegation_ids=$11::uuid[], metadata=$12::jsonb, updated_at=now() where id=$13`,
          [...calValores, cal.rows[0].id],
        );
      } else {
        await db.query(
          `insert into core.sports_calendar_events (event_id, sport, league, home_team, away_team, venue, start_at_utc, status, external_id, source, delegation_ids, metadata)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::uuid[],$12::jsonb)`,
          calValores,
        );
      }
    }
    await db.query('commit');
    console.log(`\nListo: ${insertadas} pruebas nuevas, ${actualizadas} actualizadas.`);
  } catch (e) {
    try { await db.query('rollback'); } catch {}
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
