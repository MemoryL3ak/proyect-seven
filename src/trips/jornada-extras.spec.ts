import {
  jornadaDelDia,
  jornadasDeViajes,
  resumenDeJornadas,
} from './jornada-extras';

/**
 * Horas extra de jornada para el panel financiero (24-09-2026). La regla es
 * la del Control de jornada: 13 h desde el primer viaje iniciado; pasado el
 * plazo sigue como extra hasta cerrar el último viaje del día.
 */
const H = 60 * 60 * 1000;
const t0 = new Date('2026-09-23T07:30:00-03:00');
const iso = (h: number) => new Date(t0.getTime() + h * H).toISOString();
const base = {
  driverId: 'd1',
  dia: '2026-09-23',
  nombre: 'Ana Pérez',
  proveedor: 'Buses X',
};

describe('jornadaDelDia', () => {
  it('cerrada dentro del plazo no tiene extras', () => {
    const j = jornadaDelDia(
      [
        {
          ...base,
          status: 'COMPLETED',
          startedAt: iso(0),
          completedAt: iso(2),
        },
        {
          ...base,
          status: 'COMPLETED',
          startedAt: iso(9),
          completedAt: iso(11),
        },
      ],
      new Date(t0.getTime() + 20 * H),
    );
    expect(j).toMatchObject({
      abierta: false,
      horasTrabajadas: 11,
      horasExtra: 0,
      viajes: 2,
      fin: iso(11),
    });
  });

  it('cerrada pasado el plazo: extra = lo que pasó de las 13 h', () => {
    const j = jornadaDelDia(
      [
        {
          ...base,
          status: 'COMPLETED',
          startedAt: iso(0),
          completedAt: iso(2),
        },
        {
          ...base,
          status: 'COMPLETED',
          startedAt: iso(13),
          completedAt: iso(14.5),
        },
      ],
      new Date(t0.getTime() + 20 * H),
    );
    expect(j?.horasTrabajadas).toBe(14.5);
    expect(j?.horasExtra).toBe(1.5);
  });

  it('abierta con viaje pendiente: cuenta hasta ahora y queda marcada abierta', () => {
    const j = jornadaDelDia(
      [
        {
          ...base,
          status: 'COMPLETED',
          startedAt: iso(0),
          completedAt: iso(2),
        },
        { ...base, status: 'SCHEDULED', scheduledAt: iso(15) },
      ],
      new Date(t0.getTime() + 14 * H),
    );
    expect(j).toMatchObject({ abierta: true, fin: null, horasExtra: 1 });
  });

  it('un viaje devuelto a Programado con inicio viejo no arranca la jornada', () => {
    expect(
      jornadaDelDia(
        [
          {
            ...base,
            status: 'SCHEDULED',
            startedAt: iso(-10),
            scheduledAt: iso(2),
          },
        ],
        new Date(t0.getTime() + 5 * H),
      ),
    ).toBeNull();
  });
});

describe('jornadasDeViajes + resumenDeJornadas', () => {
  it('una jornada por conductor y día, y el resumen suma extras por conductor', () => {
    const ahora = new Date('2026-09-25T12:00:00-03:00');
    const filas = [
      { ...base, status: 'COMPLETED', startedAt: iso(0), completedAt: iso(14) },
      {
        ...base,
        dia: '2026-09-24',
        status: 'COMPLETED',
        startedAt: iso(24),
        completedAt: iso(30),
      },
      {
        ...base,
        driverId: 'd2',
        nombre: 'Beto Soto',
        status: 'COMPLETED',
        startedAt: iso(1),
        completedAt: iso(15),
      },
      {
        ...base,
        driverId: '',
        status: 'COMPLETED',
        startedAt: iso(1),
        completedAt: iso(15),
      },
    ];
    const jornadas = jornadasDeViajes(filas, ahora);
    expect(
      jornadas.map((j) => `${j.driverId}:${j.dia}:${j.horasExtra}`),
    ).toEqual(['d1:2026-09-24:0', 'd1:2026-09-23:1', 'd2:2026-09-23:1']);
    const r = resumenDeJornadas(jornadas, ahora);
    expect(r.totales).toEqual({
      conductores: 2,
      jornadas: 3,
      jornadasAbiertas: 0,
      jornadasConExtra: 2,
      horasTrabajadas: 34,
      horasExtra: 2,
    });
    expect(r.porConductor[0]).toMatchObject({
      driverId: 'd1',
      jornadas: 2,
      jornadasConExtra: 1,
      horasExtra: 1,
      diasConExtra: ['2026-09-23'],
    });
  });
});
