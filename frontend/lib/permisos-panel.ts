/**
 * Permisos de los usuarios del panel por módulo: "ver" o "editar"
 * (28-09-2026, usuarios de World Rugby U20). Misma regla que
 * src/auth/permisos-panel.ts, duplicada a propósito: el servidor rechaza los
 * cambios y acá se decide qué menú, qué páginas y qué aviso de "solo lectura"
 * ve cada uno.
 *
 * user_metadata: modules (vacío = todos), soloVer (los que sólo mira; su
 * presencia activa los niveles) y eventIds (vacío = todos los eventos).
 */
export type PermisosPanel = {
  modules: string[] | null;
  soloVer: string[] | null;
  eventIds: string[] | null;
};

export type Nivel = "ninguno" | "ver" | "editar";

const lista = (v: unknown): string[] | null =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : null;

export function permisosDesdeMetadata(meta: unknown): PermisosPanel {
  const m = meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};
  return { modules: lista(m.modules), soloVer: lista(m.soloVer), eventIds: lista(m.eventIds) };
}

/** Módulos separados de uno anterior: quien tenía el anterior los conserva. */
export const MODULO_PADRE: Record<string, string> = {
  "operacion.llegadas": "operacion.and",
  "operacion.salidas": "operacion.and",
  "operacion.operatividad": "operacion.viajes",
  "operacion.solicitudes": "operacion.viajes",
  "operacion.conductores": "operacion.tracking",
  "operacion.vip": "operacion.tracking",
};

export function nivelModulo(p: PermisosPanel, id: string): Nivel {
  const mods = p.modules ?? [];
  if (mods.length === 0) return "editar";
  if (id === "_always") return "editar";
  // La herencia de los módulos separados es sólo para los usuarios de antes
  // (sin niveles): a los nuevos se les marca cada módulo, y "Viajes" no debe
  // traer Operatividad Diaria ni "Tracking" el Monitoreo de Conductores.
  const padre = p.soloVer === null ? MODULO_PADRE[id] : undefined;
  const directo = mods.includes(id);
  if (!directo && !(padre && mods.includes(padre))) return "ninguno";
  const soloVer = p.soloVer ?? [];
  if (soloVer.includes(id)) return "ver";
  if (!directo && padre && soloVer.includes(padre)) return "ver";
  return "editar";
}

/** Ruta del panel → módulo que la habilita. */
export const RUTA_A_MODULO: Record<string, string> = {
  "/dashboard/comercial": "dashboard.comercial",
  "/dashboard/operacional": "dashboard.operacional",
  "/registro/eventos": "registro.eventos",
  "/registro/participantes": "registro.participantes",
  // Delegaciones se registran como pestaña de Inscripción de Participantes;
  // la página matriz (/masters/delegations) queda con el mismo permiso.
  "/masters/delegations": "registro.participantes",
  "/registro/proveedores": "registro.participantes",
  "/masters/drivers": "registro.participantes",
  "/operacion/and": "operacion.and",
  "/operacion/cumplimiento-and": "operacion.cumplimiento",
  // Desde el 28-09-2026 con módulo propio (antes colgaban de AND, Viajes o
  // Tracking): el Comité mira Llegadas sin ver las fichas de AND.
  "/operations/flights": "operacion.llegadas",
  "/operacion/salidas": "operacion.salidas",
  "/operations/daily-transport": "operacion.operatividad",
  "/operations/trip-requests": "operacion.solicitudes",
  "/operations/driver-monitoring": "operacion.conductores",
  "/operations/vip-monitoring": "operacion.vip",
  "/operations/vehicle-positions": "operacion.tracking",
  "/operations/trips": "operacion.viajes",
  // Con módulo propio: antes colgaba de "operacion.viajes" y no había forma
  // de dar transporte sin exponer tarifas de proveedores y consumo real.
  "/operations/transport-finance": "operacion.finanzas",
  "/operations/driver-heatmap": "operacion.viajes",
  "/operations/fleet": "operacion.viajes",
  "/operations/hotel-tracking": "hoteleria.tracking",
  "/masters/accommodations": "hoteleria.hoteles",
  "/masters/hotel-rooms": "hoteleria.habitaciones",
  "/operations/hotel-assignments": "hoteleria.asignaciones",
  "/operations/hotel-keys": "hoteleria.llaves",
  "/operations/salones": "hoteleria.llaves",
  "/operations/hotel-extras": "hoteleria.llaves",
  "/operations/food": "alimentacion.general",
  "/health": "salud",
  "/operations/support-chats": "_always",
  "/operations/documentos": "documentos",
  "/clientes": "clientes",
  "/deportes": "deportes",
  "/masters/disciplines": "deportes",
  "/sede": "sede",
  "/masters/venues": "sede",
  "/incidents": "incidencias",
  "/sports-calendar": "calendario",
  // Con módulo propio: antes colgaban de "operacion.viajes" y cualquier
  // usuario con Viajes veía Staff & Voluntarios y Beneficios sin quererlo.
  "/operations/workforce": "workforce",
  "/operations/coupons": "beneficios",
  "/accreditations": "acreditaciones",
  "/portal/user": "portales",
  "/portal/conductor": "portales",
  "/portal/vehicle-request": "portales",
  "/portal/access-control": "portales",
  "/portal/partner": "portales",
  "/admin/usuarios": "admin.usuarios",
  "/admin/notificaciones": "admin.notificaciones",
  "/admin/archivos": "admin.archivos",
  "/operations/sofia-actions": "_always",
  "/cuenta": "_always",
  "/inicio-guiado": "_always",
  "/ayuda": "_always",
};

/**
 * Módulo de una ruta, por el prefijo más largo: /sports-calendar/day/x es
 * del Calendario, /operations/food/cenas de Alimentación. null = ninguno.
 */
export function moduloDeRuta(ruta: string): string | null {
  const limpia = (ruta.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  let mejor: string | null = null;
  for (const prefijo of Object.keys(RUTA_A_MODULO)) {
    if (limpia === prefijo || limpia.startsWith(`${prefijo}/`)) {
      if (!mejor || prefijo.length > mejor.length) mejor = prefijo;
    }
  }
  return mejor ? RUTA_A_MODULO[mejor] : null;
}

/** Nivel del usuario en una ruta (sin módulo asociado: editar). */
export function nivelEnRuta(p: PermisosPanel, ruta: string): Nivel {
  const modulo = moduloDeRuta(ruta);
  return modulo ? nivelModulo(p, modulo) : "editar";
}

/**
 * Módulos marcados de un usuario, con los que heredaba de los módulos
 * separados si es de antes (sin niveles): al editarlo en Gestión de Usuarios
 * se ven marcados y no se pierden al guardar.
 */
export function modulosExplicitos(p: PermisosPanel): string[] {
  const mods = p.modules ?? [];
  if (p.soloVer !== null) return mods;
  const heredados = Object.entries(MODULO_PADRE)
    .filter(([, padre]) => mods.includes(padre))
    .map(([hijo]) => hijo);
  return [...new Set([...mods, ...heredados])];
}
