import { SupabaseClient } from '@supabase/supabase-js';
import { TripsService } from './trips.service';

/**
 * Ida y vuelta al editar. La fecha de regreso sólo se tomaba al crear el
 * viaje: editar la ida no movía el tramo de regreso, y pasar un viaje de
 * "Solo ida" a "Ida y vuelta" no creaba el tramo. El campo "Fecha hora
 * regreso" del editor manda `returnScheduledAt`; esto prueba qué hace el
 * servicio con él.
 */
type Llamada = {
  tabla: string;
  op: 'select' | 'update' | 'insert' | 'delete';
  datos?: unknown;
  filtros: Array<[string, unknown]>;
};

/** Cliente Supabase de mentira: registra las llamadas y responde lo pedido. */
function supabaseFalso(hijos: Record<string, unknown>[]) {
  const llamadas: Llamada[] = [];
  const from = (tabla: string) => {
    const actual: Llamada = { tabla, op: 'select', filtros: [] };
    llamadas.push(actual);
    const resultado = () => {
      if (actual.op === 'select') return { data: hijos, error: null };
      if (actual.op === 'insert') {
        return { data: { id: 'regreso-nuevo', ...(actual.datos as object) }, error: null };
      }
      return { data: null, error: null };
    };
    const b: Record<string, unknown> = {};
    const encadena = (op?: Llamada['op'], datos?: unknown) => (...args: unknown[]) => {
      if (op) {
        actual.op = op;
        actual.datos = datos ?? args[0];
      }
      return b;
    };
    b.select = encadena();
    b.update = (d: unknown) => encadena('update', d)();
    b.insert = (d: unknown) => encadena('insert', d)();
    b.delete = () => encadena('delete')();
    b.eq = (col: string, val: unknown) => {
      actual.filtros.push([col, val]);
      return b;
    };
    b.single = () => b;
    b.maybeSingle = () => b;
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve(resultado()).then(ok);
    return b;
  };
  const cliente = { schema: () => ({ from }) } as unknown as SupabaseClient;
  return { cliente, llamadas };
}

function servicio(hijos: Record<string, unknown>[]) {
  const { cliente, llamadas } = supabaseFalso(hijos);
  const s = new TripsService(cliente, {} as never, {} as never, {} as never, {} as never);
  const sincronizar = (
    s as unknown as {
      sincronizarRegreso: (
        ida: Record<string, unknown>,
        antes: Record<string, unknown>,
        dto: Record<string, unknown>,
        quiereRegreso: boolean,
      ) => Promise<void>;
    }
  ).sincronizarRegreso.bind(s);
  return { sincronizar, llamadas };
}

const ida = {
  id: 'ida-1',
  event_id: 'ev',
  origin: 'Hotel Sheraton',
  destination: 'Estadio Nacional',
  origin_hotel_id: 'hotel-1',
  destination_venue_id: 'sede-1',
  origin_venue_id: null,
  destination_hotel_id: null,
  origin_food_location_id: null,
  destination_food_location_id: null,
  requester_athlete_id: null,
  requested_vehicle_type: 'VAN_15',
  passenger_count: 12,
  trip_type: 'VIAJE_IDA_REGRESO',
  client_type: 'DELEGACION',
  notes: null,
  delegation_id: 'del-1',
  discipline_id: 'disc-1',
  all_delegations: false,
  requested_at: null,
  return_at: null,
};

describe('TripsService · tramo de regreso al editar la ida', () => {
  it('mueve la hora del tramo de regreso que ya existe', async () => {
    const regreso = { id: 'regreso-1', leg_type: 'RETURN', status: 'SCHEDULED' };
    const { sincronizar, llamadas } = servicio([regreso]);

    await sincronizar(ida, {}, { returnScheduledAt: '2026-10-01T21:30:00.000Z' }, true);

    const update = llamadas.find((l) => l.op === 'update');
    expect(update?.tabla).toBe('trips');
    expect(update?.datos).toEqual({ scheduled_at: '2026-10-01T21:30:00.000Z' });
    expect(update?.filtros).toEqual([['id', 'regreso-1']]);
    expect(llamadas.some((l) => l.op === 'insert')).toBe(false);
  });

  it('crea el tramo de regreso al revés de la ida si no existía', async () => {
    const { sincronizar, llamadas } = servicio([]);

    await sincronizar(
      ida,
      { athleteIds: ['a1', 'a2'] },
      { isRoundTrip: true, returnScheduledAt: '2026-10-01T21:30:00.000Z' },
      true,
    );

    const insert = llamadas.find((l) => l.op === 'insert' && l.tabla === 'trips');
    expect(insert?.datos).toMatchObject({
      parent_trip_id: 'ida-1',
      leg_type: 'RETURN',
      is_round_trip: true,
      status: 'REQUESTED',
      scheduled_at: '2026-10-01T21:30:00.000Z',
      origin: 'Estadio Nacional',
      destination: 'Hotel Sheraton',
      origin_venue_id: 'sede-1',
      destination_hotel_id: 'hotel-1',
      passenger_count: 12,
      delegation_id: 'del-1',
    });
    // Los pasajeros de la ida viajan también en el regreso.
    const pasajeros = llamadas.find((l) => l.op === 'insert' && l.tabla === 'trip_athletes');
    expect(pasajeros?.datos).toEqual([
      { trip_id: 'regreso-nuevo', athlete_id: 'a1' },
      { trip_id: 'regreso-nuevo', athlete_id: 'a2' },
    ]);
  });

  it('al dejar el viaje en "Solo ida" borra el regreso que aún no salió', async () => {
    const { sincronizar, llamadas } = servicio([
      { id: 'regreso-1', leg_type: 'RETURN', status: 'SCHEDULED' },
    ]);

    await sincronizar(ida, {}, { isRoundTrip: false }, false);

    const borrado = llamadas.find((l) => l.op === 'delete');
    expect(borrado?.filtros).toEqual([['id', 'regreso-1']]);
  });

  it('no borra un regreso que ya está en ruta', async () => {
    const { sincronizar, llamadas } = servicio([
      { id: 'regreso-1', leg_type: 'RETURN', status: 'EN_ROUTE' },
    ]);

    await sincronizar(ida, {}, { isRoundTrip: false }, false);

    expect(llamadas.some((l) => l.op === 'delete')).toBe(false);
  });

  it('sin cambios para el regreso no toca nada', async () => {
    const { sincronizar, llamadas } = servicio([
      { id: 'regreso-1', leg_type: 'RETURN', status: 'SCHEDULED' },
    ]);

    await sincronizar(ida, {}, { notes: 'sólo la ida' }, true);

    expect(llamadas.filter((l) => l.op !== 'select')).toEqual([]);
  });
});
