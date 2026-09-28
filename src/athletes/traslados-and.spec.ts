import {
  AEROPUERTO,
  cambiosDeTraslado,
  claveTrasladoAnd,
  normalizarVuelo,
  tramosAnd,
} from './traslados-and';

/**
 * 27-09-2026: al guardar una ficha de AND con su vuelo, el vuelo va al
 * Monitor de Vuelos y se crean sus traslados asignados al conductor. Los
 * datos son los de un juez de World Rugby U20 cargado ese día.
 */
const SERGIO = {
  id: 'sergio',
  trip_type: null,
  flight_number: 'LA1324',
  airline: 'LATAM',
  arrival_time: '2026-09-28T17:15:00.000Z',
  departure_time: '2026-10-18T18:05:00.000Z',
  transport_type: null,
  metadata: {
    arrival: {
      time: '2026-09-28T17:15:00.000Z',
      airline: 'LATAM',
      flightNumber: 'LA1324',
      driverId: 'hector',
    },
    departure: {
      time: '2026-10-18T18:05:00.000Z',
      airline: 'LATAM',
      flightNumber: 'LA1325',
    },
  },
};

describe('tramosAnd', () => {
  it('una ficha con llegada y salida da un Transfer In y un Transfer Out', () => {
    const [llegada, salida] = tramosAnd(SERGIO);
    expect(llegada).toMatchObject({
      sentido: 'LLEGADA',
      tipoViaje: 'TRANSFER_IN',
      vuelo: 'LA1324',
      horaViaje: '2026-09-28T17:15:00.000Z',
      conductorId: 'hector',
      clave: 'and:sergio:LLEGADA',
    });
    expect(salida).toMatchObject({
      sentido: 'SALIDA',
      tipoViaje: 'TRANSFER_OUT',
      vuelo: 'LA1325',
      horaVuelo: '2026-10-18T18:05:00.000Z',
      conductorId: null,
    });
  });

  it('la salida recoge en el hotel 3 horas antes del vuelo', () => {
    const salida = tramosAnd(SERGIO)[1];
    expect(salida.horaViaje).toBe('2026-10-18T15:05:00.000Z');
  });

  it('sin número de vuelo no hay traslado', () => {
    expect(
      tramosAnd({
        id: 'x',
        arrival_time: '2026-09-28T17:15:00.000Z',
        metadata: {},
      }),
    ).toEqual([]);
  });

  it('quien llega en bus no va al aeropuerto', () => {
    expect(tramosAnd({ ...SERGIO, transport_type: 'BUS' })).toEqual([]);
  });

  it('del formulario: un solo vuelo y el tipo de viaje dice si es llegada o salida', () => {
    const soloSalida = tramosAnd({
      id: 's',
      trip_type: 'DEPARTURE',
      flight_number: 'la 714',
      departure_time: '2026-10-18T18:55:00.000Z',
      metadata: { departure: { driverId: 'patricia' } },
    });
    expect(soloSalida).toHaveLength(1);
    expect(soloSalida[0]).toMatchObject({
      tipoViaje: 'TRANSFER_OUT',
      vuelo: 'LA714',
      conductorId: 'patricia',
    });
  });

  it('la hora editada en la fila manda sobre la de la carga', () => {
    const [llegada] = tramosAnd({
      ...SERGIO,
      arrival_time: '2026-09-28T19:00:00.000Z',
    });
    expect(llegada.horaViaje).toBe('2026-09-28T19:00:00.000Z');
  });
});

describe('cambiosDeTraslado', () => {
  const deseado = {
    scheduledAt: '2026-09-28T17:15:00.000Z',
    driverId: 'hector',
    origin: AEROPUERTO,
    destination: 'Hotel Sheraton',
    flightNumber: 'LA1324',
  };
  const actual = {
    status: 'SCHEDULED',
    scheduledAt: '2026-09-28T17:15:00.000Z',
    driverId: 'hector',
    origin: AEROPUERTO,
    destination: 'Hotel Sheraton',
    flightNumber: 'LA 1324',
  };

  it('si ya calza no se toca (no ensucia la bitácora del viaje)', () => {
    expect(cambiosDeTraslado(actual, deseado)).toEqual({});
  });

  it('cambia la hora y el conductor que cambiaron en la ficha', () => {
    expect(
      cambiosDeTraslado(actual, {
        ...deseado,
        scheduledAt: '2026-09-28T18:00:00.000Z',
        driverId: 'patricia',
      }),
    ).toEqual({
      scheduledAt: '2026-09-28T18:00:00.000Z',
      driverId: 'patricia',
    });
  });

  it('una ficha sin conductor no le quita el que asignó despacho', () => {
    expect(cambiosDeTraslado(actual, { ...deseado, driverId: null })).toEqual(
      {},
    );
  });

  it('quitar el conductor en la ficha lo quita del viaje si lo puso AND', () => {
    expect(
      cambiosDeTraslado(
        { ...actual, andDriverId: 'hector' },
        { ...deseado, driverId: null },
      ),
    ).toEqual({ driverId: null });
  });

  it('pero no quita el que despacho cambió en Viajes', () => {
    expect(
      cambiosDeTraslado(
        { ...actual, driverId: 'patricia', andDriverId: 'hector' },
        { ...deseado, driverId: null },
      ),
    ).toEqual({});
  });

  it('un traslado que ya partió no se reescribe', () => {
    expect(
      cambiosDeTraslado(
        { ...actual, status: 'EN_ROUTE' },
        { ...deseado, driverId: 'otro' },
      ),
    ).toEqual({});
  });
});

describe('utilidades', () => {
  it('normaliza el vuelo y arma la clave', () => {
    expect(normalizarVuelo(' h2 1811 ')).toBe('H21811');
    expect(claveTrasladoAnd('abc', 'SALIDA')).toBe('and:abc:SALIDA');
  });
});
