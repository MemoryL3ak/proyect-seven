import {
  AEROPUERTO,
  arregloTransferInOut,
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
  it('una ficha con llegada y salida da los dos tramos de un Transfer In Out', () => {
    const [llegada, salida] = tramosAnd(SERGIO);
    expect(llegada).toMatchObject({
      sentido: 'LLEGADA',
      tipoViaje: 'TRANSFER_IN_OUT',
      vuelo: 'LA1324',
      horaViaje: '2026-09-28T17:15:00.000Z',
      conductorId: 'hector',
      clave: 'and:sergio:LLEGADA',
    });
    expect(salida).toMatchObject({
      sentido: 'SALIDA',
      tipoViaje: 'TRANSFER_IN_OUT',
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

  /**
   * 29-09-2026, Delegación Canadá (Rugby): "dice Transfer In Out y es solo
   * IN". Sólo llegada → Transfer In; con llegada y salida, Transfer In Out.
   */
  it('sólo llegada es Transfer In; con los dos vuelos, Transfer In Out', () => {
    const soloLlegada = tramosAnd({
      id: 'canada',
      trip_type: 'ARRIVAL',
      metadata: { arrival: { flightNumber: 'AC92', time: '2026-09-30T10:25:00.000Z', driverId: 'alexander' } },
    });
    expect(soloLlegada.map((t) => [t.sentido, t.tipoViaje])).toEqual([['LLEGADA', 'TRANSFER_IN']]);
    expect(tramosAnd(SERGIO).map((t) => t.tipoViaje)).toEqual(['TRANSFER_IN_OUT', 'TRANSFER_IN_OUT']);
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

/**
 * 28-09-2026: Ariel quiere un solo viaje Transfer In Out por persona, no un
 * Transfer In y un Transfer Out sueltos. Los de Sergio Alvarenga eran dos.
 */
describe('arregloTransferInOut', () => {
  const llegadaSergio = {
    id: 'in-sergio',
    tripType: 'TRANSFER_IN',
    parentTripId: null,
    legType: null,
    isRoundTrip: false,
    returnAt: null,
    scheduledAt: '2026-09-28T17:15:00.000Z',
  };
  const salidaSergio = {
    id: 'out-sergio',
    tripType: 'TRANSFER_OUT',
    parentTripId: null,
    legType: null,
    isRoundTrip: false,
    returnAt: null,
    scheduledAt: new Date('2026-10-18T15:05:00.000Z'),
  };

  it('une el Transfer In y el Transfer Out de antes en un Transfer In Out con su regreso', () => {
    expect(arregloTransferInOut(llegadaSergio, salidaSergio)).toEqual([
      {
        id: 'in-sergio',
        tripType: 'TRANSFER_IN_OUT',
        parentTripId: null,
        legType: 'OUTBOUND',
        isRoundTrip: true,
        returnAt: '2026-10-18T15:05:00.000Z',
      },
      {
        id: 'out-sergio',
        tripType: 'TRANSFER_IN_OUT',
        parentTripId: 'in-sergio',
        legType: 'RETURN',
        isRoundTrip: true,
        returnAt: null,
      },
    ]);
  });

  it('si ya están unidos no toca nada', () => {
    const [ida, regreso] = arregloTransferInOut(llegadaSergio, salidaSergio);
    expect(
      arregloTransferInOut(
        { ...llegadaSergio, ...ida },
        { ...salidaSergio, ...regreso },
      ),
    ).toEqual([]);
  });

  it('si la salida cambia de hora, la llegada guarda la nueva hora de regreso', () => {
    const [ida, regreso] = arregloTransferInOut(llegadaSergio, salidaSergio);
    const arreglos = arregloTransferInOut(
      { ...llegadaSergio, ...ida },
      { ...salidaSergio, ...regreso, scheduledAt: '2026-10-18T16:00:00.000Z' },
    );
    expect(arreglos).toHaveLength(1);
    expect(arreglos[0]).toMatchObject({
      id: 'in-sergio',
      returnAt: '2026-10-18T16:00:00.000Z',
    });
  });

  it('con un solo tramo, ése es el viaje, sin regreso (y un Transfer In Out suelto pasa a Out)', () => {
    expect(arregloTransferInOut(null, { ...salidaSergio, tripType: 'TRANSFER_IN_OUT' })).toEqual([
      {
        id: 'out-sergio',
        tripType: 'TRANSFER_OUT',
        parentTripId: null,
        legType: null,
        isRoundTrip: false,
        returnAt: null,
      },
    ]);
  });
});

describe('utilidades', () => {
  it('normaliza el vuelo y arma la clave', () => {
    expect(normalizarVuelo(' h2 1811 ')).toBe('H21811');
    expect(claveTrasladoAnd('abc', 'SALIDA')).toBe('and:abc:SALIDA');
  });
});

/**
 * 28-09-2026: la plantilla de AND trae, por tramo, teléfono del conductor,
 * patente y tipo de flota además del conductor. La flota queda como vehículo
 * pedido del traslado y la patente en su metadata.
 */
describe('flota y patente de la plantilla', () => {
  const conFlota = {
    ...SERGIO,
    metadata: {
      ...SERGIO.metadata,
      arrival: {
        ...SERGIO.metadata.arrival,
        fleetType: 'SUV',
        vehiclePlate: 'TRSB84',
      },
    },
  };

  it('el tramo lleva la flota y la patente de la ficha', () => {
    const [llegada, salida] = tramosAnd(conFlota);
    expect(llegada).toMatchObject({ flota: 'SUV', patente: 'TRSB84' });
    expect(salida).toMatchObject({ flota: null, patente: null });
  });

  const actual = {
    status: 'SCHEDULED',
    scheduledAt: '2026-09-28T17:15:00.000Z',
    driverId: 'carlos',
    origin: AEROPUERTO,
    destination: 'Hotel Sheraton',
    flightNumber: 'LA1324',
    requestedVehicleType: null,
    andPatente: null,
  };
  const deseado = {
    scheduledAt: '2026-09-28T17:15:00.000Z',
    driverId: 'carlos',
    origin: AEROPUERTO,
    destination: 'Hotel Sheraton',
    flightNumber: 'LA1324',
  };

  it('pone la flota y la patente en un traslado ya creado', () => {
    expect(
      cambiosDeTraslado(actual, {
        ...deseado,
        flota: 'SUV',
        patente: 'TRSB84',
      }),
    ).toEqual({ requestedVehicleType: 'SUV', andPatente: 'TRSB84' });
  });

  it('una plantilla sin flota no borra la que dejó despacho', () => {
    expect(
      cambiosDeTraslado(
        { ...actual, requestedVehicleType: 'Van 15-17' },
        { ...deseado, flota: null, patente: null },
      ),
    ).toEqual({});
  });
});
