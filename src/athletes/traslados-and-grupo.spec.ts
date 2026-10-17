import { TrasladosAndService } from './traslados-and.service';
import { claveGrupoAnd, clavesDelViaje } from './traslados-and';

/**
 * 16-10-2026: los 22 jugadores de México llegaron en tres vuelos y Viajes
 * mostraba 22 traslados de 1 pax iguales; el conductor inició y cerró 22
 * veces el mismo viaje. Las fichas que comparten delegación, vuelo, hotel y
 * conductor viajan en UN viaje con todos como pasajeros.
 *
 * La base se simula en memoria: cada consulta del servicio se reconoce por
 * su forma y se aplica sobre una lista de viajes.
 */

type Ficha = {
  id: string;
  event_id: string;
  delegation_id: string | null;
  user_type: string | null;
  trip_type: string | null;
  flight_number: string | null;
  airline: string | null;
  origin: string | null;
  arrival_time: string | null;
  departure_time: string | null;
  transport_type: string | null;
  hotel_accommodation_id: string | null;
  arrival_flight_id: string | null;
  metadata: Record<string, unknown>;
  hotel_name: string | null;
};

type Viaje = {
  id: string;
  orden: number;
  event_id: string;
  status: string;
  scheduled_at: string | null;
  driver_id: string | null;
  origin: string | null;
  destination: string | null;
  requested_vehicle_type: string | null;
  delegation_id: string | null;
  destination_hotel_id: string | null;
  origin_hotel_id: string | null;
  passenger_count: number | null;
  requester_athlete_id: string | null;
  trip_type: string | null;
  parent_trip_id: string | null;
  leg_type: string | null;
  is_round_trip: boolean | null;
  return_at: string | null;
  metadata: Record<string, unknown>;
};

const LLEGADA_LA715 = '2026-10-15T14:30:00.000Z';
const SALIDA_LA716 = '2026-10-20T20:00:00.000Z';

function ficha(id: string, extra: Partial<Ficha> & { metadata?: Record<string, unknown> } = {}): Ficha {
  return {
    id,
    event_id: 'rugby',
    delegation_id: 'mex',
    user_type: 'ATHLETE',
    trip_type: null,
    flight_number: null,
    airline: null,
    origin: 'MEX',
    arrival_time: null,
    departure_time: null,
    transport_type: null,
    hotel_accommodation_id: 'almasur',
    arrival_flight_id: null,
    hotel_name: 'Hotel Almasur Providencia',
    ...extra,
    metadata: extra.metadata ?? {
      arrival: { flightNumber: 'LA 715', time: LLEGADA_LA715, airline: 'LATAM', driverId: 'eduardo' },
    },
  };
}

function base(fichas: Ficha[]) {
  const porId = new Map(fichas.map((f) => [f.id, f]));
  const viajes: Viaje[] = [];
  const pasajeros = new Map<string, string[]>();
  let n = 0;
  const limpiar = (sql: string) => sql.replace(/\s+/g, ' ').trim();
  const porOrden = (a: Viaje, b: Viaje) => a.orden - b.orden;

  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    const s = limpiar(sql);
    if (s.startsWith('select a.id, a.event_id')) {
      const f = porId.get(String(params[0]));
      return f ? [f] : [];
    }
    if (s.startsWith('select id from transport.flights')) return [];
    if (s.startsWith('insert into transport.flights')) return [{ id: `vuelo-${params[1]}` }];
    if (s.startsWith('update core.athletes set arrival_flight_id')) return [];
    if (s.startsWith('delete from transport.flights')) return [];
    if (s.startsWith('select arrival_flight_id from core.athletes')) return [{ arrival_flight_id: null }];

    if (s.includes("(t.metadata->>'andKey' = $1 or t.metadata->'andKeys' ? $1)")) {
      const clave = String(params[0]);
      let lista = viajes
        .filter((v) => v.status !== 'CANCELLED' && clavesDelViaje(v.metadata).includes(clave))
        .sort(porOrden);
      if (s.includes('and id <> $2')) lista = lista.filter((v) => v.id !== params[1]);
      return s.includes('limit 1') ? lista.slice(0, 1) : lista;
    }
    if (s.includes("t.metadata->>'andGrupo' = $1")) {
      return viajes
        .filter(
          (v) =>
            v.metadata.andGrupo === params[0] &&
            ['REQUESTED', 'SCHEDULED'].includes(v.status) &&
            (params[1] == null || v.id !== params[1]),
        )
        .sort(porOrden)
        .slice(0, 1);
    }
    if (s.includes('from transport.trips t where id = $1')) {
      return viajes.filter((v) => v.id === params[0]);
    }
    if (s.includes('where parent_trip_id = $1')) {
      return viajes.filter(
        (v) => v.parent_trip_id === params[0] && v.metadata.source === 'AND' && v.status !== 'CANCELLED',
      );
    }
    if (s.startsWith('update transport.trips set passenger_count')) {
      const v = viajes.find((x) => x.id === params[0]);
      if (!v) throw new Error(`viaje ${String(params[0])} no existe`);
      v.passenger_count = Number(params[1]);
      v.requester_athlete_id = (params[2] as string | null) ?? null;
      const log = Array.isArray(v.metadata.log) ? v.metadata.log : [];
      v.metadata = {
        ...v.metadata,
        ...JSON.parse(String(params[3])),
        log: [...log, ...JSON.parse(String(params[4]))],
      };
      return [];
    }
    if (s.startsWith('delete from transport.trip_athletes')) {
      pasajeros.delete(String(params[0]));
      return [];
    }
    if (s.startsWith('insert into transport.trip_athletes')) {
      pasajeros.set(String(params[0]), [...(params[1] as string[])]);
      return [];
    }
    if (s.startsWith('delete from transport.trips where id = $1')) {
      const i = viajes.findIndex((v) => v.id === params[0]);
      if (i >= 0) viajes.splice(i, 1);
      pasajeros.delete(String(params[0]));
      for (const v of viajes) if (v.parent_trip_id === params[0]) v.parent_trip_id = null;
      return [];
    }
    if (s.startsWith('update transport.trips set trip_type')) {
      const v = viajes.find((x) => x.id === params[0]);
      if (!v) throw new Error(`viaje ${String(params[0])} no existe`);
      [v.trip_type, v.parent_trip_id, v.leg_type, v.is_round_trip, v.return_at] = [
        params[1] as string,
        (params[2] as string | null) ?? null,
        (params[3] as string | null) ?? null,
        Boolean(params[4]),
        (params[5] as string | null) ?? null,
      ];
      return [];
    }
    throw new Error(`consulta no prevista: ${s.slice(0, 90)}`);
  });

  const trips = {
    create: jest.fn(async (dto: Record<string, any>) => {
      const id = `viaje-${++n}`;
      viajes.push({
        id,
        orden: n,
        event_id: dto.eventId,
        status: dto.driverId ? 'SCHEDULED' : 'REQUESTED',
        scheduled_at: dto.scheduledAt ?? null,
        driver_id: dto.driverId ?? null,
        origin: dto.origin ?? null,
        destination: dto.destination ?? null,
        requested_vehicle_type: dto.requestedVehicleType ?? null,
        delegation_id: dto.delegationId ?? null,
        destination_hotel_id: dto.destinationHotelId ?? null,
        origin_hotel_id: dto.originHotelId ?? null,
        passenger_count: dto.passengerCount ?? null,
        requester_athlete_id: dto.requesterAthleteId ?? null,
        trip_type: dto.tripType ?? null,
        parent_trip_id: null,
        leg_type: null,
        is_round_trip: false,
        return_at: null,
        metadata: { ...(dto.metadata ?? {}), flightNumber: dto.flightNumber ?? null },
      });
      pasajeros.set(id, [...(dto.athleteIds ?? [])]);
      return { id };
    }),
    update: jest.fn(async (id: string, dto: Record<string, any>) => {
      const v = viajes.find((x) => x.id === id);
      if (!v) throw new Error(`viaje ${id} no existe`);
      if (dto.scheduledAt !== undefined) v.scheduled_at = dto.scheduledAt;
      if (dto.driverId !== undefined) v.driver_id = dto.driverId;
      if (dto.origin !== undefined) v.origin = dto.origin;
      if (dto.destination !== undefined) v.destination = dto.destination;
      if (dto.delegationId !== undefined) v.delegation_id = dto.delegationId;
      if (dto.destinationHotelId !== undefined) v.destination_hotel_id = dto.destinationHotelId;
      if (dto.requestedVehicleType !== undefined) v.requested_vehicle_type = dto.requestedVehicleType;
      if (dto.metadata) v.metadata = { ...v.metadata, ...dto.metadata };
      if (dto.flightNumber !== undefined) v.metadata.flightNumber = dto.flightNumber;
      return v;
    }),
  };

  const svc = new TrasladosAndService({ query } as any, trips as any);
  const viaje = (id: string) => {
    const v = viajes.find((x) => x.id === id);
    if (!v) throw new Error(`viaje ${id} no existe`);
    return v;
  };
  return { svc, viajes, pasajeros, trips, query, viaje, porId };
}

const GRUPO_LA715 = claveGrupoAnd({
  sentido: 'LLEGADA',
  vuelo: 'LA715',
  horaVuelo: LLEGADA_LA715,
  delegationId: 'mex',
  hotelId: 'almasur',
  conductorId: 'eduardo',
});

describe('traslados de AND por grupo', () => {
  it('dos fichas de la misma delegación, vuelo, hotel y conductor viajan en un solo viaje', async () => {
    const b = base([ficha('ana'), ficha('beto')]);
    await b.svc.sincronizar('ana');
    await b.svc.sincronizar('beto');

    expect(b.trips.create).toHaveBeenCalledTimes(1);
    expect(b.trips.create.mock.calls[0][0]).toMatchObject({
      requesterAthleteId: 'ana',
      athleteIds: ['ana'],
      passengerCount: 1,
      delegationId: 'mex',
      driverId: 'eduardo',
      metadata: { andKey: 'and:ana:LLEGADA', andKeys: ['and:ana:LLEGADA'], andGrupo: GRUPO_LA715, source: 'AND' },
    });
    const v = b.viaje('viaje-1');
    expect(v.passenger_count).toBe(2);
    expect(v.requester_athlete_id).toBe('ana');
    expect(v.metadata.andKeys).toEqual(['and:ana:LLEGADA', 'and:beto:LLEGADA']);
    expect(v.metadata.andKey).toBe('and:ana:LLEGADA');
    expect(b.pasajeros.get('viaje-1')).toEqual(['ana', 'beto']);
    expect(v.metadata.log).toEqual([
      expect.objectContaining({ action: 'PASSENGER_COUNT_CHANGED', by: 'AND', detail: '1 → 2' }),
    ]);
  });

  it('volver a guardar una ficha del grupo no lo cambia', async () => {
    const b = base([ficha('ana'), ficha('beto')]);
    await b.svc.sincronizar('ana');
    await b.svc.sincronizar('beto');
    await b.svc.sincronizar('ana');
    expect(b.viajes).toHaveLength(1);
    expect(b.trips.update).not.toHaveBeenCalled();
    expect(b.viaje('viaje-1').passenger_count).toBe(2);
    expect(b.viaje('viaje-1').metadata.log).toHaveLength(1);
  });

  it('otro conductor en la ficha es otro vehículo: otro viaje', async () => {
    const b = base([
      ficha('ana'),
      ficha('carla', {
        metadata: { arrival: { flightNumber: 'LA 715', time: LLEGADA_LA715, driverId: 'pedro' } },
      }),
    ]);
    await b.svc.sincronizar('ana');
    await b.svc.sincronizar('carla');
    expect(b.trips.create).toHaveBeenCalledTimes(2);
    expect(b.viaje('viaje-2').driver_id).toBe('pedro');
    expect(b.viaje('viaje-2').metadata.andKeys).toEqual(['and:carla:LLEGADA']);
  });

  it('sin conductor ni delegación también se agrupa (mismo vuelo y hotel)', async () => {
    const sinNada = (id: string) =>
      ficha(id, { delegation_id: null, metadata: { arrival: { flightNumber: 'LA715', time: LLEGADA_LA715 } } });
    const b = base([sinNada('x'), sinNada('y')]);
    await b.svc.sincronizar('x');
    await b.svc.sincronizar('y');
    expect(b.viajes).toHaveLength(1);
    expect(b.viaje('viaje-1').status).toBe('REQUESTED');
    expect(b.viaje('viaje-1').passenger_count).toBe(2);
  });

  it('una ficha que cambia de vuelo deja el grupo y crea el suyo; el grupo sigue con los demás', async () => {
    const b = base([ficha('ana'), ficha('beto')]);
    await b.svc.sincronizar('ana');
    await b.svc.sincronizar('beto');

    b.porId.get('beto')!.metadata = {
      arrival: { flightNumber: 'AV97', time: '2026-10-15T08:45:00.000Z', driverId: 'eduardo' },
    };
    await b.svc.sincronizar('beto');

    expect(b.viajes).toHaveLength(2);
    const grupo = b.viaje('viaje-1');
    expect(grupo.passenger_count).toBe(1);
    expect(grupo.metadata.andKeys).toEqual(['and:ana:LLEGADA']);
    expect(b.pasajeros.get('viaje-1')).toEqual(['ana']);
    expect(grupo.metadata.log).toEqual([
      expect.objectContaining({ detail: '1 → 2' }),
      expect.objectContaining({ detail: '2 → 1' }),
    ]);
    const suyo = b.viaje('viaje-2');
    expect(suyo.metadata.andKeys).toEqual(['and:beto:LLEGADA']);
    expect(suyo.metadata.flightNumber).toBe('AV97');
    expect(b.pasajeros.get('viaje-2')).toEqual(['beto']);
  });

  it('si la primera ficha se va, el solicitante pasa a la siguiente', async () => {
    const b = base([ficha('ana'), ficha('beto')]);
    await b.svc.sincronizar('ana');
    await b.svc.sincronizar('beto');
    b.porId.get('ana')!.hotel_accommodation_id = 'otro-hotel';
    await b.svc.sincronizar('ana');
    const grupo = b.viaje('viaje-1');
    expect(grupo.requester_athlete_id).toBe('beto');
    expect(grupo.metadata.andKey).toBe('and:beto:LLEGADA');
  });

  it('la ficha que viaja sola y cambia de conductor mueve su viaje, no lo borra', async () => {
    const b = base([ficha('ana')]);
    await b.svc.sincronizar('ana');
    b.porId.get('ana')!.metadata = {
      arrival: { flightNumber: 'LA 715', time: LLEGADA_LA715, driverId: 'pedro' },
    };
    await b.svc.sincronizar('ana');

    expect(b.trips.create).toHaveBeenCalledTimes(1);
    expect(b.trips.update).toHaveBeenCalledWith(
      'viaje-1',
      expect.objectContaining({ driverId: 'pedro', metadata: expect.objectContaining({ andDriverId: 'pedro' }) }),
      null,
    );
    const v = b.viaje('viaje-1');
    expect(v.driver_id).toBe('pedro');
    expect(v.metadata.andGrupo).toBe(GRUPO_LA715.replace(':eduardo', ':pedro'));
  });

  it('una ficha sola que cambia de vuelo se suma al viaje que ya existe de ese vuelo', async () => {
    const b = base([
      ficha('ana'),
      ficha('beto', { metadata: { arrival: { flightNumber: 'AV97', time: '2026-10-15T08:45:00.000Z', driverId: 'eduardo' } } }),
    ]);
    await b.svc.sincronizar('ana');
    await b.svc.sincronizar('beto');
    b.porId.get('beto')!.metadata = { arrival: { flightNumber: 'LA715', time: LLEGADA_LA715, driverId: 'eduardo' } };
    await b.svc.sincronizar('beto');

    expect(b.viajes.map((v) => v.id)).toEqual(['viaje-1']);
    expect(b.viaje('viaje-1').metadata.andKeys).toEqual(['and:ana:LLEGADA', 'and:beto:LLEGADA']);
    expect(b.pasajeros.get('viaje-1')).toEqual(['ana', 'beto']);
  });

  it('al borrar una ficha, el viaje sigue con los demás; al borrar la última, se borra', async () => {
    const b = base([ficha('ana'), ficha('beto')]);
    await b.svc.sincronizar('ana');
    await b.svc.sincronizar('beto');

    await b.svc.antesDeBorrarFicha('ana');
    expect(b.viajes).toHaveLength(1);
    expect(b.viaje('viaje-1').metadata.andKeys).toEqual(['and:beto:LLEGADA']);
    expect(b.viaje('viaje-1').requester_athlete_id).toBe('beto');

    await b.svc.antesDeBorrarFicha('beto');
    expect(b.viajes).toHaveLength(0);
  });

  it('un viaje que ya partió no se toca aunque la ficha cambie de vuelo', async () => {
    const b = base([ficha('ana')]);
    await b.svc.sincronizar('ana');
    b.viaje('viaje-1').status = 'EN_ROUTE';
    b.porId.get('ana')!.metadata = {
      arrival: { flightNumber: 'AV97', time: '2026-10-15T08:45:00.000Z', driverId: 'eduardo' },
    };
    await b.svc.sincronizar('ana');
    expect(b.viajes).toHaveLength(1);
    expect(b.trips.create).toHaveBeenCalledTimes(1);
    expect(b.trips.update).not.toHaveBeenCalled();
    expect(b.viaje('viaje-1').metadata.flightNumber).toBe('LA715');
  });

  it('un viaje de antes (uno por persona, sólo andKey) sigue siendo el suyo y recibe sus claves de grupo', async () => {
    const b = base([ficha('ana'), ficha('beto')]);
    b.viajes.push({
      id: 'antiguo',
      orden: 0,
      event_id: 'rugby',
      status: 'SCHEDULED',
      scheduled_at: LLEGADA_LA715,
      driver_id: 'eduardo',
      origin: 'Aeropuerto Internacional Arturo Merino Benítez, Pudahuel, Santiago, Chile',
      destination: 'Hotel Almasur Providencia',
      requested_vehicle_type: null,
      delegation_id: 'mex',
      destination_hotel_id: 'almasur',
      origin_hotel_id: null,
      passenger_count: 1,
      requester_athlete_id: 'ana',
      trip_type: 'TRANSFER_IN',
      parent_trip_id: null,
      leg_type: null,
      is_round_trip: false,
      return_at: null,
      metadata: {
        andKey: 'and:ana:LLEGADA',
        andDriverId: 'eduardo',
        source: 'AND',
        flightNumber: 'LA715',
        flightTime: LLEGADA_LA715,
      },
    });
    await b.svc.sincronizar('ana');
    expect(b.trips.create).not.toHaveBeenCalled();
    expect(b.trips.update).not.toHaveBeenCalled();
    const v = b.viaje('antiguo');
    expect(v.metadata.andKeys).toEqual(['and:ana:LLEGADA']);
    expect(v.metadata.andGrupo).toBe(GRUPO_LA715);
    expect(b.pasajeros.get('antiguo')).toEqual(['ana']);

    // Y la siguiente ficha del mismo vuelo se suma a él.
    await b.svc.sincronizar('beto');
    expect(b.trips.create).not.toHaveBeenCalled();
    expect(v.metadata.andKeys).toEqual(['and:ana:LLEGADA', 'and:beto:LLEGADA']);
    expect(v.passenger_count).toBe(2);
  });

  describe('Transfer In Out por grupo', () => {
    const idaYVuelta = (id: string) =>
      ficha(id, {
        metadata: {
          arrival: { flightNumber: 'LA 715', time: LLEGADA_LA715, driverId: 'eduardo' },
          departure: { flightNumber: 'LA 716', time: SALIDA_LA716, driverId: 'eduardo' },
        },
      });

    it('llegada y salida de las mismas fichas se unen en un Transfer In Out', async () => {
      const b = base([idaYVuelta('ana'), idaYVuelta('beto')]);
      await b.svc.sincronizar('ana');
      await b.svc.sincronizar('beto');

      expect(b.viajes).toHaveLength(2);
      const llegada = b.viaje('viaje-1');
      const salida = b.viaje('viaje-2');
      expect(llegada.metadata.andKeys).toEqual(['and:ana:LLEGADA', 'and:beto:LLEGADA']);
      expect(salida.metadata.andKeys).toEqual(['and:ana:SALIDA', 'and:beto:SALIDA']);
      expect(llegada).toMatchObject({ trip_type: 'TRANSFER_IN_OUT', leg_type: 'OUTBOUND', is_round_trip: true });
      expect(salida).toMatchObject({ trip_type: 'TRANSFER_IN_OUT', leg_type: 'RETURN', parent_trip_id: 'viaje-1' });
      expect(b.pasajeros.get('viaje-2')).toEqual(['ana', 'beto']);
    });

    it('si el grupo se parte a la vuelta, la llegada es Transfer In y cada salida un Transfer Out', async () => {
      const b = base([idaYVuelta('ana'), idaYVuelta('beto')]);
      await b.svc.sincronizar('ana');
      await b.svc.sincronizar('beto');

      b.porId.get('beto')!.metadata = {
        arrival: { flightNumber: 'LA 715', time: LLEGADA_LA715, driverId: 'eduardo' },
        departure: { flightNumber: 'LA 720', time: '2026-10-21T20:00:00.000Z', driverId: 'eduardo' },
      };
      await b.svc.sincronizar('beto');

      expect(b.viajes).toHaveLength(3);
      expect(b.viaje('viaje-1')).toMatchObject({ trip_type: 'TRANSFER_IN', leg_type: null, is_round_trip: false, return_at: null });
      expect(b.viaje('viaje-2')).toMatchObject({ trip_type: 'TRANSFER_OUT', parent_trip_id: null, leg_type: null });
      expect(b.viaje('viaje-2').metadata.andKeys).toEqual(['and:ana:SALIDA']);
      expect(b.viaje('viaje-3')).toMatchObject({ trip_type: 'TRANSFER_OUT', parent_trip_id: null });
      expect(b.viaje('viaje-3').metadata.andKeys).toEqual(['and:beto:SALIDA']);
    });

    it('un regreso que despacho agregó a mano no se descuelga', async () => {
      const b = base([ficha('ana')]);
      await b.svc.sincronizar('ana');
      b.viajes.push({
        ...b.viaje('viaje-1'),
        id: 'regreso-manual',
        orden: 99,
        parent_trip_id: 'viaje-1',
        leg_type: 'RETURN',
        metadata: {},
      });
      await b.svc.sincronizar('ana');
      expect(b.viaje('regreso-manual').parent_trip_id).toBe('viaje-1');
    });
  });
});
