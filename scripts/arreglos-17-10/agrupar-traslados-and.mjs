#!/usr/bin/env node
/**
 * Agrupa los traslados de AND que ya existen: un viaje por grupo (misma
 * delegación, sentido, vuelo, hora, hotel y conductor) en vez de uno por
 * persona. 17-10-2026, pedido de Ariel: los 22 de México llegaron en tres
 * vuelos y Viajes mostraba 22 traslados de 1 pax; el backend ya crea un
 * viaje por grupo desde hoy (src/athletes/traslados-and.service.ts), este
 * script ordena lo que quedó de antes.
 *
 *   node scripts/arreglos-17-10/agrupar-traslados-and.mjs                 # muestra qué haría
 *   node scripts/arreglos-17-10/agrupar-traslados-and.mjs --aplicar       # lo hace
 *   node scripts/arreglos-17-10/agrupar-traslados-and.mjs --evento <id>   # sólo un evento
 *   node scripts/arreglos-17-10/agrupar-traslados-and.mjs --incluir-terminados
 *
 * Por defecto sólo toca los viajes que no han partido (Solicitado /
 * Programado). Con --incluir-terminados también junta los ya realizados
 * (los de México del 15-10): se juntan sólo entre viajes del mismo estado,
 * el que sobrevive es el más antiguo y conserva sus horas reales; la
 * bitácora de los que se absorben se copia a la suya. Ojo: el panel
 * financiero valoriza por viaje, así que juntar 22 viajes en 3 cambia lo
 * que se cobra por ese día.
 *
 * Qué escribe, por grupo con más de un viaje:
 *   - en el viaje que queda: passenger_count, metadata.andKeys / andKey /
 *     andGrupo, los pasajeros en transport.trip_athletes y una línea en la
 *     bitácora ("AGRUPADO");
 *   - borra los demás viajes del grupo (sus regresos quedan sueltos y se
 *     vuelven a emparejar abajo);
 *   - a todos los viajes de AND, también a los que viajan solos, les deja
 *     escritas sus claves de grupo (andKeys, andGrupo);
 *   - vuelve a unir llegada y salida como Transfer In Out sólo cuando llevan
 *     exactamente a las mismas fichas; si no, Transfer In y Transfer Out.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const args = process.argv.slice(2);
const aplicar = args.includes("--aplicar");
const incluirTerminados = args.includes("--incluir-terminados");
const iEvento = args.indexOf("--evento");
const soloEvento = iEvento >= 0 ? args[iEvento + 1] : null;

function leerEnv() {
  const env = {};
  for (const nombre of [".env", ".env.local"]) {
    const ruta = resolve(process.cwd(), nombre);
    if (!existsSync(ruta)) continue;
    for (const linea of readFileSync(ruta, "utf8").split(/\r?\n/)) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

/* ─── Las mismas reglas que src/athletes/traslados-and.ts ─── */

const SIN_INICIAR = new Set(["REQUESTED", "SCHEDULED"]);
const normalizarVuelo = (v) => String(v ?? "").replace(/\s+/g, "").toUpperCase();
const texto = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
const iso = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const fichaDeClave = (clave) => /^and:([^:]+):(LLEGADA|SALIDA)$/.exec(clave)?.[1] ?? null;
const sentidoDeClave = (clave) => /^and:[^:]+:(LLEGADA|SALIDA)$/.exec(clave)?.[1] ?? null;

function clavesDelViaje(meta) {
  const lista = Array.isArray(meta?.andKeys) ? meta.andKeys.filter((k) => typeof k === "string" && k) : [];
  if (lista.length) return [...new Set(lista)];
  const unica = texto(meta?.andKey);
  return unica ? [unica] : [];
}
const fichasDe = (claves) => claves.map(fichaDeClave).filter(Boolean);

const claveGrupo = (g) =>
  ["and:grupo", g.sentido, normalizarVuelo(g.vuelo), g.horaVuelo, g.delegationId ?? "-", g.hotelId ?? "-", g.conductorId ?? "-"].join(":");

function grupoDelViaje(v) {
  const meta = v.metadata ?? {};
  const guardado = texto(meta.andGrupo);
  if (guardado) return guardado;
  const [clave] = clavesDelViaje(meta);
  const sentido = clave ? sentidoDeClave(clave) : null;
  const vuelo = texto(meta.flightNumber);
  const horaVuelo = iso(meta.flightTime);
  if (!sentido || !vuelo || !horaVuelo) return null;
  return claveGrupo({
    sentido,
    vuelo,
    horaVuelo,
    delegationId: v.delegation_id,
    hotelId: sentido === "LLEGADA" ? v.destination_hotel_id : v.origin_hotel_id,
    conductorId: texto(meta.andDriverId),
  });
}

const mismasFichas = (a, b) => {
  const sa = new Set(a), sb = new Set(b);
  return sa.size > 0 && sa.size === sb.size && [...sa].every((x) => sb.has(x));
};

const tipoDeTramo = (sentido, hayLlegada, haySalida) =>
  hayLlegada && haySalida ? "TRANSFER_IN_OUT" : sentido === "LLEGADA" ? "TRANSFER_IN" : "TRANSFER_OUT";

/* ─── Plan ─── */

async function main() {
  const env = { ...leerEnv(), ...process.env };
  const url = env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL en .env");
  const cliente = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await cliente.connect();
  try {
    const { rows: viajes } = await cliente.query(
      `select t.id, t.event_id, e.name as evento, t.status, t.created_at, t.scheduled_at,
              t.delegation_id, t.destination_hotel_id, t.origin_hotel_id, t.passenger_count,
              t.requester_athlete_id, t.trip_type, t.parent_trip_id, t.leg_type, t.is_round_trip,
              t.return_at, t.metadata,
              coalesce((select array_agg(ta.athlete_id::text) from transport.trip_athletes ta where ta.trip_id = t.id), '{}') as pasajeros
         from transport.trips t
         join core.events e on e.id = t.event_id
        where t.metadata->>'source' = 'AND'
          and t.status <> 'CANCELLED'
          and ($1::uuid is null or t.event_id = $1::uuid)
        order by t.created_at`,
      [soloEvento],
    );

    const porId = new Map(viajes.map((v) => [v.id, v]));
    for (const v of viajes) {
      v.claves = clavesDelViaje(v.metadata);
      v.grupo = grupoDelViaje(v);
      v.sentido = v.claves[0] ? sentidoDeClave(v.claves[0]) : null;
    }

    const sinGrupo = viajes.filter((v) => !v.grupo);
    const candidatos = viajes.filter((v) => v.grupo && (incluirTerminados || SIN_INICIAR.has(v.status)));

    // Grupos: misma clave y mismo estado (un viaje terminado no absorbe uno pendiente).
    const grupos = new Map();
    for (const v of candidatos) {
      const k = `${v.grupo}|${v.status}`;
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(v);
    }
    const fusiones = [...grupos.values()].filter((lista) => lista.length > 1);

    console.log(`Viajes de AND: ${viajes.length} (${candidatos.length} candidatos a agrupar${incluirTerminados ? ", incluidos terminados" : ", sólo sin iniciar"}).`);
    if (sinGrupo.length) {
      console.log(`Sin datos para agrupar (sin vuelo u hora en la metadata): ${sinGrupo.length} → se dejan como están.`);
    }
    console.log(`Grupos con más de un viaje: ${fusiones.length}\n`);

    // Lo que quedará: cada viaje con sus claves definitivas.
    const absorbidos = new Set();
    for (const lista of fusiones) {
      lista.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const [queda, ...resto] = lista;
      const claves = [...new Set(lista.flatMap((v) => v.claves))];
      queda.clavesFinales = claves;
      queda.absorbe = resto;
      for (const v of resto) absorbidos.add(v.id);
      const meta = queda.metadata ?? {};
      console.log(
        `• ${queda.evento} · ${queda.sentido} · ${meta.flightNumber ?? "?"} ${iso(meta.flightTime) ?? ""} · ` +
          `delegación ${queda.delegation_id ?? "-"} · ${queda.status}: ${lista.length} viajes → 1 (${claves.length} pax)`,
      );
      console.log(`    queda ${queda.id}; se borran ${resto.map((v) => v.id).join(", ")}`);
    }

    if (!aplicar) {
      console.log(`\nSimulación: nada se escribió. Para aplicar: --aplicar${incluirTerminados ? " --incluir-terminados" : ""}.`);
      return;
    }

    await cliente.query("begin");
    try {
      const ahora = new Date().toISOString();
      for (const v of viajes) {
        if (absorbidos.has(v.id) || !v.grupo) continue;
        const claves = v.clavesFinales ?? v.claves;
        const fichas = fichasDe(claves);
        // Un viaje que viaja solo sólo recibe sus claves de grupo: ni los
        // pasajeros ni el cupo que le haya puesto despacho (hay traslados de
        // AND con 40 pax a los que un bus les cambió el cupo) se tocan.
        if (!v.absorbe) {
          await cliente.query(
            `update transport.trips
                set metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb, updated_at = now()
              where id = $1`,
            [v.id, JSON.stringify({ andKeys: claves, andKey: claves[0], andGrupo: v.grupo })],
          );
          continue;
        }
        const extraLog = [];
        {
          for (const a of v.absorbe) extraLog.push(...(Array.isArray(a.metadata?.log) ? a.metadata.log : []));
          extraLog.sort((x, y) => String(x.at ?? "").localeCompare(String(y.at ?? "")));
          extraLog.push({
            action: "PASSENGER_COUNT_CHANGED",
            by: "AND",
            at: ahora,
            detail: `AGRUPADO: ${v.absorbe.length + 1} viajes → 1 (${(v.passenger_count ?? 1)} → ${fichas.length})`,
          });
        }
        await cliente.query(
          `update transport.trips
              set passenger_count = $2,
                  requester_athlete_id = coalesce(requester_athlete_id, $3),
                  metadata = (coalesce(metadata, '{}'::jsonb) || $4::jsonb)
                             || jsonb_build_object('log', coalesce(metadata->'log', '[]'::jsonb) || $5::jsonb),
                  updated_at = now()
            where id = $1`,
          [v.id, fichas.length, fichas[0] ?? null, JSON.stringify({ andKeys: claves, andKey: claves[0], andGrupo: v.grupo }), JSON.stringify(extraLog)],
        );
        await cliente.query(`delete from transport.trip_athletes where trip_id = $1`, [v.id]);
        if (fichas.length) {
          await cliente.query(
            `insert into transport.trip_athletes (trip_id, athlete_id)
             select $1, unnest($2::uuid[]) on conflict do nothing`,
            [v.id, fichas],
          );
        }
        v.claves = claves;
      }
      if (absorbidos.size) {
        await cliente.query(`delete from transport.trips where id = any($1::uuid[])`, [[...absorbidos]]);
      }

      // Transfer In Out: llegada y salida con exactamente las mismas fichas.
      const vivos = viajes.filter((v) => !absorbidos.has(v.id) && v.grupo);
      const llegadas = vivos.filter((v) => v.sentido === "LLEGADA");
      const salidas = vivos.filter((v) => v.sentido === "SALIDA");
      const emparejadas = new Set();
      for (const ll of llegadas) {
        const fichas = fichasDe(ll.claves);
        const sal = salidas.find((s) => !emparejadas.has(s.id) && mismasFichas(fichasDe(s.claves), fichas)) ?? null;
        if (sal) emparejadas.add(sal.id);
        await cliente.query(
          `update transport.trips set trip_type = $2, parent_trip_id = null, leg_type = $3, is_round_trip = $4, return_at = $5, updated_at = now() where id = $1`,
          [ll.id, tipoDeTramo("LLEGADA", true, Boolean(sal)), sal ? "OUTBOUND" : null, Boolean(sal), sal ? iso(sal.scheduled_at) : null],
        );
        if (sal) {
          await cliente.query(
            `update transport.trips set trip_type = 'TRANSFER_IN_OUT', parent_trip_id = $2, leg_type = 'RETURN', is_round_trip = true, return_at = null, updated_at = now() where id = $1`,
            [sal.id, ll.id],
          );
        }
      }
      for (const s of salidas) {
        if (emparejadas.has(s.id)) continue;
        await cliente.query(
          `update transport.trips set trip_type = 'TRANSFER_OUT', parent_trip_id = null, leg_type = null, is_round_trip = false, return_at = null, updated_at = now() where id = $1`,
          [s.id],
        );
      }
      await cliente.query("commit");
      console.log(`\nListo: ${fusiones.length} grupos unidos, ${absorbidos.size} viajes borrados, ${vivos.length} viajes con sus claves de grupo.`);
    } catch (err) {
      await cliente.query("rollback");
      throw err;
    }
  } finally {
    await cliente.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
