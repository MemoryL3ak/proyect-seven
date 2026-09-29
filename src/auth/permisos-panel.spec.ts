import {
  mensajeSinPermiso,
  nivelModulo,
  permisosDesdeMetadata,
  puedeEscribir,
  puedeVerEvento,
  reglaDeEscritura,
} from './permisos-panel';

/**
 * 28-09-2026: usuarios de World Rugby U20. Víctor (Comité) mira casi todo sin
 * poder cambiar nada; edita sólo Solicitudes T1/VIP e Incidencias, y valida
 * los servicios del día en el Calendario Operacional.
 */
const RUGBY = '8bbd6a39-a788-4588-9c15-7aec86080dba';
const JDE = '0e168c10-a7d1-47ae-9784-265a5fc25d9d';

const VICTOR = permisosDesdeMetadata({
  role: 'Coordinador Comité',
  modules: [
    'operacion.llegadas',
    'operacion.salidas',
    'calendario',
    'operacion.tracking',
    'operacion.viajes',
    'operacion.solicitudes',
    'operacion.vip',
    'sede',
    'incidencias',
    'hoteleria.hoteles',
    'alimentacion.general',
    'deportes',
  ],
  soloVer: [
    'operacion.llegadas',
    'operacion.salidas',
    'calendario',
    'operacion.tracking',
    'operacion.viajes',
    'operacion.vip',
    'sede',
    'hoteleria.hoteles',
    'alimentacion.general',
    'deportes',
  ],
  eventIds: [RUGBY],
});

/** Un operador de antes: módulos sin niveles. Nada cambia para él. */
const OPERADOR_ANTIGUO = permisosDesdeMetadata({ modules: ['operacion.viajes'] });
const ADMIN = permisosDesdeMetadata({ role: 'Administrador' });

describe('permisos del panel', () => {
  it('Víctor puede ver Viajes pero no cambiarlos', () => {
    expect(nivelModulo(VICTOR, 'operacion.viajes')).toBe('ver');
    const regla = reglaDeEscritura('PATCH', '/trips/abc', { driverId: 'x' }, { clientType: 'TA', tripType: 'VIAJE_IDA' });
    expect(puedeEscribir(VICTOR, regla)).toBe(false);
    expect(mensajeSinPermiso(VICTOR, regla!)).toMatch(/sólo puede ver Viajes/);
  });

  it('pero sí edita una solicitud T1/VIP', () => {
    expect(nivelModulo(VICTOR, 'operacion.solicitudes')).toBe('editar');
    const regla = reglaDeEscritura('PATCH', '/trips/abc', { driverId: 'x' }, { clientType: 'VIP', tripType: 'PORTAL_REQUEST' });
    expect(puedeEscribir(VICTOR, regla)).toBe(true);
  });

  it('crea una reserva T1/VIP desde Solicitudes, pero no un viaje común', () => {
    const reserva = reglaDeEscritura('POST', '/trips', { clientType: 'T1', status: 'REQUESTED' });
    expect(puedeEscribir(VICTOR, reserva)).toBe(true);
    const comun = reglaDeEscritura('POST', '/trips', { clientType: 'TA' });
    expect(puedeEscribir(VICTOR, comun)).toBe(false);
  });

  it('valida los servicios del día aunque el calendario sea sólo de lectura', () => {
    const regla = reglaDeEscritura('PATCH', '/trips/abc', { committeeValidated: true, committeeValidatedBy: 'Comité Organizador' });
    expect(puedeEscribir(VICTOR, regla)).toBe(true);
    // Pero no puede colar otro cambio junto con la validación.
    const conOtro = reglaDeEscritura('PATCH', '/trips/abc', { committeeValidated: true, status: 'CANCELLED' }, { clientType: 'TA', tripType: 'Partido' });
    expect(puedeEscribir(VICTOR, conOtro)).toBe(false);
  });

  it('edita incidencias y no toca sedes, vuelos ni traslados', () => {
    expect(puedeEscribir(VICTOR, reglaDeEscritura('POST', '/incidents', {}))).toBe(true);
    expect(puedeEscribir(VICTOR, reglaDeEscritura('PATCH', '/venues/1', {}))).toBe(false);
    expect(puedeEscribir(VICTOR, reglaDeEscritura('POST', '/flights', {}))).toBe(false);
    expect(puedeEscribir(VICTOR, reglaDeEscritura('POST', '/athletes/x/traslados', {}))).toBe(false);
    const traslado = reglaDeEscritura('PATCH', '/trips/t', { status: 'COMPLETED' }, { clientType: 'TF', tripType: 'TRANSFER_IN_OUT' });
    expect(puedeEscribir(VICTOR, traslado)).toBe(false);
  });

  it('no puede crear eventos ni usuarios: no tiene esos módulos', () => {
    const eventos = reglaDeEscritura('POST', '/events', {});
    expect(puedeEscribir(VICTOR, eventos)).toBe(false);
    expect(mensajeSinPermiso(VICTOR, eventos!)).toMatch(/no tiene acceso a Eventos/);
    expect(puedeEscribir(VICTOR, reglaDeEscritura('POST', '/auth/register', {}))).toBe(false);
  });

  it('su propia cuenta y los avisos push siguen libres', () => {
    expect(reglaDeEscritura('PATCH', '/auth/me/password', {})).toBeNull();
    expect(reglaDeEscritura('POST', '/push-notifications/register', {})).toBeNull();
    expect(reglaDeEscritura('GET', '/trips', {})).toBeNull();
  });

  it('los usuarios de antes (sin niveles) y el administrador no cambian', () => {
    expect(puedeEscribir(OPERADOR_ANTIGUO, reglaDeEscritura('POST', '/events', {}))).toBe(true);
    expect(puedeEscribir(ADMIN, reglaDeEscritura('POST', '/auth/register', {}))).toBe(true);
  });

  it('quien tenía AND conserva Llegadas y Salidas', () => {
    const conAnd = permisosDesdeMetadata({ modules: ['operacion.and'] });
    expect(nivelModulo(conAnd, 'operacion.llegadas')).toBe('editar');
  });

  it('a un usuario nuevo, Viajes no le trae Operatividad Diaria ni Solicitudes', () => {
    const soloViajes = permisosDesdeMetadata({ modules: ['operacion.viajes'], soloVer: [] });
    expect(nivelModulo(soloViajes, 'operacion.operatividad')).toBe('ninguno');
    expect(nivelModulo(soloViajes, 'operacion.solicitudes')).toBe('ninguno');
    // Pero con Viajes puede editar una solicitud (la regla acepta cualquiera de los dos).
    const regla = reglaDeEscritura('PATCH', '/trips/abc', { driverId: 'x' }, { clientType: 'VIP', tripType: 'PORTAL_REQUEST' });
    expect(puedeEscribir(soloViajes, regla)).toBe(true);
  });

  it('Víctor sólo ve el evento de Rugby', () => {
    expect(puedeVerEvento(VICTOR, RUGBY)).toBe(true);
    expect(puedeVerEvento(VICTOR, JDE)).toBe(false);
    expect(puedeVerEvento(ADMIN, JDE)).toBe(true);
  });
});
