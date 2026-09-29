/**
 * Permisos de los usuarios del panel por módulo, con dos niveles: "ver" y
 * "editar" (28-09-2026, usuarios de World Rugby U20). Hasta ese día la lista
 * de módulos sólo ocultaba ítems del menú: cualquiera con sesión del panel
 * podía cambiar viajes, eventos o sedes por la API. Víctor y Victoria (Comité)
 * debían poder mirar casi todo sin tocar nada.
 *
 * Todo vive en el user_metadata de Supabase:
 *   modules  — módulos que ve (vacío o ausente = todos, como siempre).
 *   soloVer  — de ésos, los que sólo puede mirar. Su presencia (aunque vacía)
 *              activa el modo estricto: los cambios exigen el módulo con
 *              nivel "editar". Los usuarios anteriores no lo tienen y siguen
 *              igual que antes.
 *   eventIds — eventos que puede ver (vacío o ausente = todos).
 *
 * La misma regla de niveles vive en frontend/lib/permisos-panel.ts (menú,
 * páginas y aviso de "solo lectura"), duplicada a propósito como la jornada.
 */
import { normalizeClientType } from '../shared/client-types';

export type PermisosPanel = {
  modules: string[] | null;
  soloVer: string[] | null;
  eventIds: string[] | null;
};

export type Nivel = 'ninguno' | 'ver' | 'editar';

const lista = (v: unknown): string[] | null =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : null;

export function permisosDesdeMetadata(meta: unknown): PermisosPanel {
  const m = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {};
  return {
    modules: lista(m.modules),
    soloVer: lista(m.soloVer),
    eventIds: lista(m.eventIds),
  };
}

/**
 * Módulos que se separaron de uno anterior: quien ya tenía el anterior los
 * conserva (un usuario con "AND" seguía viendo Llegadas y Salidas).
 */
export const MODULO_PADRE: Record<string, string> = {
  'operacion.llegadas': 'operacion.and',
  'operacion.salidas': 'operacion.and',
  'operacion.operatividad': 'operacion.viajes',
  'operacion.solicitudes': 'operacion.viajes',
  'operacion.conductores': 'operacion.tracking',
  'operacion.vip': 'operacion.tracking',
};

export function nivelModulo(p: PermisosPanel, id: string): Nivel {
  const mods = p.modules ?? [];
  if (mods.length === 0) return 'editar';
  // La herencia de los módulos separados es sólo para los usuarios de antes
  // (sin niveles): a los nuevos se les marca cada módulo, y "Viajes" no debe
  // traer Operatividad Diaria ni "Tracking" el Monitoreo de Conductores.
  const padre = p.soloVer === null ? MODULO_PADRE[id] : undefined;
  const directo = mods.includes(id);
  if (!directo && !(padre && mods.includes(padre))) return 'ninguno';
  const soloVer = p.soloVer ?? [];
  if (soloVer.includes(id)) return 'ver';
  if (!directo && padre && soloVer.includes(padre)) return 'ver';
  return 'editar';
}

/**
 * El valor de un viaje (trip_cost) y el valor cliente de las tarifas son lo
 * que se le cobra al cliente (29-09-2026: "les aparece el costo del viaje y
 * eso es lo que cobramos nosotros"). Sólo los ven los usuarios del panel con
 * Finanzas —administradores y BVAN—. El Comité, los participantes, los
 * conductores (ven el valor proveedor) y cualquier ruta pública no: el
 * servidor lo borra de la respuesta y lo ignora si llega en un cambio (así un
 * guardado desde una pantalla sin el valor no lo pisa).
 */
export const CAMPOS_DE_COBRO = ['tripCost', 'trip_cost', 'clientPrice', 'client_price'];

export function ocultaCobros(
  caller: { type: string; kind?: string; permisos?: PermisosPanel } | null | undefined,
): boolean {
  if (!caller) return true;
  if (caller.type === 'staff') return !!caller.permisos && nivelModulo(caller.permisos, 'operacion.finanzas') === 'ninguno';
  // El conductor tampoco: lo suyo es el valor proveedor (GET
  // /trips/valores-proveedor), no lo que se le cobra al cliente.
  return true;
}

/** Quien no ve el valor tampoco lo cambia: se saca del cuerpo de su petición. */
export function quitarCobrosDelCuerpo(
  caller: Parameters<typeof ocultaCobros>[0],
  cuerpo: unknown,
): void {
  if (!ocultaCobros(caller) || !cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return;
  for (const campo of CAMPOS_DE_COBRO) delete (cuerpo as Record<string, unknown>)[campo];
}

/** El usuario está en el modo estricto (configurado con niveles). */
export const esEstricto = (p: PermisosPanel) =>
  p.soloVer !== null && (p.modules ?? []).length > 0;

export type ViajeParaPermiso = { clientType: string | null; tripType: string | null };

export type Regla = {
  /** Basta uno de éstos con el nivel pedido. */
  modulos: string[];
  nivel: 'ver' | 'editar';
  /** Para el mensaje. */
  que: string;
};

const HOTELERIA = [
  'hoteleria.tracking',
  'hoteleria.hoteles',
  'hoteleria.habitaciones',
  'hoteleria.asignaciones',
  'hoteleria.llaves',
];

/** Prefijo de la ruta → módulos que la protegen (cambios). */
const POR_PREFIJO: Array<[string, Regla]> = [
  ['admin/files', { modulos: ['admin.archivos'], nivel: 'editar', que: 'Archivos' }],
  ['accreditations', { modulos: ['acreditaciones'], nivel: 'editar', que: 'Acreditaciones' }],
  ['accommodations', { modulos: HOTELERIA, nivel: 'editar', que: 'Hotelería' }],
  ['hotel-', { modulos: HOTELERIA, nivel: 'editar', que: 'Hotelería' }],
  ['delegation-hotels', { modulos: HOTELERIA, nivel: 'editar', que: 'Hotelería' }],
  ['salones', { modulos: HOTELERIA, nivel: 'editar', que: 'Hotelería' }],
  ['coupons', { modulos: ['beneficios'], nivel: 'editar', que: 'Beneficios' }],
  ['coupon-partners', { modulos: ['beneficios'], nivel: 'editar', que: 'Beneficios' }],
  ['delegations', { modulos: ['registro.participantes'], nivel: 'editar', que: 'Inscripción' }],
  ['providers', { modulos: ['registro.participantes'], nivel: 'editar', que: 'Proveedores' }],
  ['provider-participants', { modulos: ['registro.participantes'], nivel: 'editar', que: 'Proveedores' }],
  ['drivers', { modulos: ['registro.participantes', 'operacion.viajes'], nivel: 'editar', que: 'Conductores' }],
  ['disciplines', { modulos: ['deportes'], nivel: 'editar', que: 'Deportes' }],
  ['premiaciones', { modulos: ['deportes'], nivel: 'editar', que: 'Deportes' }],
  ['sports-calendar', { modulos: ['calendario', 'deportes'], nivel: 'editar', que: 'Calendario Operacional' }],
  ['event-documents', { modulos: ['documentos'], nivel: 'editar', que: 'Documentos' }],
  ['events', { modulos: ['registro.eventos'], nivel: 'editar', que: 'Eventos' }],
  ['fleet', { modulos: ['operacion.viajes'], nivel: 'editar', que: 'Viajes' }],
  ['transports', { modulos: ['operacion.viajes'], nivel: 'editar', que: 'Viajes' }],
  ['flights', { modulos: ['operacion.llegadas', 'operacion.and'], nivel: 'editar', que: 'Monitoreo de Llegadas' }],
  ['food-', { modulos: ['alimentacion.general'], nivel: 'editar', que: 'Alimentación' }],
  ['meal-time-blocks', { modulos: ['alimentacion.general'], nivel: 'editar', que: 'Alimentación' }],
  ['incidents', { modulos: ['incidencias'], nivel: 'editar', que: 'Incidencias' }],
  ['trip-requests', { modulos: ['operacion.solicitudes'], nivel: 'editar', que: 'Solicitudes T1/VIP' }],
  ['venues', { modulos: ['sede'], nivel: 'editar', que: 'Sede' }],
  ['vip-monitoring', { modulos: ['operacion.vip'], nivel: 'editar', que: 'Monitoreo VIP' }],
  ['workforce', { modulos: ['workforce'], nivel: 'editar', que: 'Staff & Voluntarios' }],
];

const VIAJES: Regla = { modulos: ['operacion.viajes', 'operacion.operatividad'], nivel: 'editar', que: 'Viajes' };

/**
 * Qué exige un cambio (POST, PATCH, PUT, DELETE). null = nada: rutas de la
 * propia cuenta, de los portales o que no pertenecen a un módulo.
 * `viaje` se consulta sólo para PATCH/PUT/DELETE /trips/:id.
 */
export function reglaDeEscritura(
  metodo: string,
  ruta: string,
  cuerpo: unknown,
  viaje?: ViajeParaPermiso | null,
): Regla | null {
  const m = metodo.toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return null;
  const partes = ruta.split('?')[0].replace(/^\/+|\/+$/g, '').split('/');
  const base = partes[0] ?? '';
  const resto = partes.slice(1);

  if (base === 'auth') {
    return resto[0] === 'register' || resto[0] === 'users'
      ? { modulos: ['admin.usuarios'], nivel: 'editar', que: 'Gestión de Usuarios' }
      : null;
  }
  if (base === 'push-notifications') {
    return resto[0] === 'test'
      ? { modulos: ['admin.notificaciones'], nivel: 'editar', que: 'Notificaciones' }
      : null;
  }
  if (base === 'athletes') {
    if (resto[1] === 'traslados') {
      return {
        modulos: ['operacion.llegadas', 'operacion.salidas', 'operacion.and'],
        nivel: 'editar',
        que: 'Monitoreo de Llegadas',
      };
    }
    return { modulos: ['registro.participantes', 'operacion.and'], nivel: 'editar', que: 'Participantes' };
  }
  if (base === 'trips') {
    const id = resto[0];
    const porId = id && resto.length === 1 && ['PATCH', 'PUT', 'DELETE'].includes(m);
    if (porId && m !== 'DELETE') {
      const campos =
        cuerpo && typeof cuerpo === 'object' ? Object.keys(cuerpo as Record<string, unknown>) : [];
      // "Validar actividades del día" del Calendario Operacional: sólo marca
      // la validación del Comité. Basta ver el calendario.
      if (campos.length > 0 && campos.every((c) => c === 'committeeValidated' || c === 'committeeValidatedBy')) {
        return { modulos: ['calendario'], nivel: 'ver', que: 'Calendario Operacional' };
      }
    }
    if (porId && viaje) {
      const tipoCliente = normalizeClientType(viaje.clientType);
      if (tipoCliente === 'T1' || tipoCliente === 'VIP') {
        return { modulos: ['operacion.solicitudes', 'operacion.viajes'], nivel: 'editar', que: 'Solicitudes T1/VIP' };
      }
      if (String(viaje.tripType ?? '').toUpperCase().startsWith('TRANSFER_')) {
        return {
          modulos: ['operacion.viajes', 'operacion.llegadas', 'operacion.salidas'],
          nivel: 'editar',
          que: 'traslados de aeropuerto',
        };
      }
    }
    // Reserva T1/VIP nueva desde Solicitudes (28-09-2026): la crea quien
    // edita Solicitudes, igual que la edita.
    if (m === 'POST' && resto.length === 0 && cuerpo && typeof cuerpo === 'object') {
      const tipoNuevo = normalizeClientType(String((cuerpo as { clientType?: unknown }).clientType ?? ''));
      if (tipoNuevo === 'T1' || tipoNuevo === 'VIP') {
        return { modulos: ['operacion.solicitudes', 'operacion.viajes'], nivel: 'editar', que: 'Solicitudes T1/VIP' };
      }
    }
    return VIAJES;
  }
  for (const [prefijo, regla] of POR_PREFIJO) {
    if (prefijo.endsWith('-') ? base.startsWith(prefijo) : base === prefijo) return regla;
  }
  return null;
}

/** ¿Puede hacer el cambio? Sin modo estricto, todo como antes. */
export function puedeEscribir(p: PermisosPanel, regla: Regla | null): boolean {
  if (!regla || !esEstricto(p)) return true;
  return regla.modulos.some((id) => {
    const nivel = nivelModulo(p, id);
    return regla.nivel === 'ver' ? nivel !== 'ninguno' : nivel === 'editar';
  });
}

export function mensajeSinPermiso(p: PermisosPanel, regla: Regla): string {
  const alguno = regla.modulos.some((id) => nivelModulo(p, id) !== 'ninguno');
  return alguno
    ? `Tu usuario sólo puede ver ${regla.que}: no puede hacer cambios.`
    : `Tu usuario no tiene acceso a ${regla.que}.`;
}

/** ¿Puede ver el evento? Sin eventos asignados, todos. */
export const puedeVerEvento = (p: PermisosPanel, eventId: string | null | undefined) =>
  !p.eventIds || p.eventIds.length === 0 || (eventId ? p.eventIds.includes(eventId) : true);
