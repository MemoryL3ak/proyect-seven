/**
 * Pestaña Vuelos de la app del Coordinador de Sede (28-09-2026, World Rugby
 * U20): las llegadas y salidas del evento agrupadas por vuelo, con el estado
 * del traslado de cada pasajero. Los datos vienen de GET /flights/evento.
 */
import { claveDiaEvento } from "@/lib/hora-evento";
import { estadoVuelo, type EstadoVuelo } from "@/lib/estado-vuelo";

export type PasajeroVuelo = {
  id: string;
  nombre: string | null;
  pais: string | null;
  delegacion: string | null;
  vuelo_llegada: string | null;
  aerolinea_llegada: string | null;
  hora_llegada: string | null;
  origen: string | null;
  vuelo_salida: string | null;
  aerolinea_salida: string | null;
  hora_salida: string | null;
  traslado_llegada: string | null;
  conductor_llegada: string | null;
  traslado_salida: string | null;
  conductor_salida: string | null;
  recogida_salida: string | null;
};

export type EstadoTraslado = "SIN_TRASLADO" | "PENDIENTE" | "EN_CURSO" | "REALIZADO";

export function estadoTraslado(status: string | null | undefined): EstadoTraslado {
  const s = String(status ?? "").toUpperCase();
  if (!s) return "SIN_TRASLADO";
  if (s === "COMPLETED" || s === "DROPPED_OFF") return "REALIZADO";
  if (s === "EN_ROUTE" || s === "PICKED_UP") return "EN_CURSO";
  return "PENDIENTE";
}

export type GrupoVuelo = {
  clave: string;
  vuelo: string;
  aerolinea: string | null;
  origen: string | null;
  hora: string;
  /** Recogida en el hotel (salidas). */
  recogida: string | null;
  estado: EstadoVuelo;
  pasajeros: Array<{ id: string; nombre: string; pais: string | null; traslado: EstadoTraslado; conductor: string | null }>;
};

const norm = (v: string) => v.replace(/\s+/g, "").toUpperCase();

/** Agrupa por vuelo y hora; ordena por hora. `sentido` elige llegadas o salidas. */
export function agruparVuelos(filas: PasajeroVuelo[], sentido: "LLEGADA" | "SALIDA", ahora: Date): GrupoVuelo[] {
  const grupos = new Map<string, GrupoVuelo>();
  for (const f of filas) {
    const llegada = sentido === "LLEGADA";
    const vuelo = llegada ? f.vuelo_llegada : f.vuelo_salida;
    const hora = llegada ? f.hora_llegada : f.hora_salida;
    if (!vuelo || !hora) continue;
    const clave = `${norm(vuelo)}|${hora}`;
    const status = llegada ? f.traslado_llegada : f.traslado_salida;
    let g = grupos.get(clave);
    if (!g) {
      g = {
        clave,
        vuelo: vuelo.trim(),
        aerolinea: (llegada ? f.aerolinea_llegada : f.aerolinea_salida) || null,
        origen: llegada ? f.origen || null : null,
        hora,
        recogida: llegada ? null : f.recogida_salida,
        estado: "PROGRAMADO",
        pasajeros: [],
      };
      grupos.set(clave, g);
    }
    g.pasajeros.push({
      id: f.id,
      nombre: f.nombre || "—",
      pais: f.pais,
      traslado: estadoTraslado(status),
      conductor: (llegada ? f.conductor_llegada : f.conductor_salida) || null,
    });
  }
  const lista = [...grupos.values()];
  for (const g of lista) {
    const estados = filas
      .filter((f) => g.pasajeros.some((p) => p.id === f.id))
      .map((f) => (sentido === "LLEGADA" ? f.traslado_llegada : null));
    g.estado = estadoVuelo(g.hora, ahora, estados);
  }
  return lista.sort((a, b) => new Date(a.hora).getTime() - new Date(b.hora).getTime());
}

/** "Próximos": los de hoy (aunque ya pasaron) y los que vienen. */
export function soloProximos(grupos: GrupoVuelo[], ahora: Date): GrupoVuelo[] {
  const hoy = claveDiaEvento(ahora);
  return grupos.filter((g) => claveDiaEvento(g.hora) >= hoy);
}
