import { describe, expect, it } from 'vitest';
import {
  estadoAlMarcar,
  pasajerosDelVuelo,
  resumenTraslados,
  trasladosDelVuelo,
} from './marcar-traslado';

describe('marcar traslado (monitor de vuelos)', () => {
  it('un traslado sin terminar se marca Completado; uno terminado vuelve a Programado o Solicitado', () => {
    expect(estadoAlMarcar({ status: 'SCHEDULED', driverId: 'c1' })).toBe(
      'COMPLETED',
    );
    expect(estadoAlMarcar({ status: 'PICKED_UP', driverId: 'c1' })).toBe(
      'COMPLETED',
    );
    expect(estadoAlMarcar({ status: 'COMPLETED', driverId: 'c1' })).toBe(
      'SCHEDULED',
    );
    expect(estadoAlMarcar({ status: 'DROPPED_OFF', driverId: null })).toBe(
      'REQUESTED',
    );
  });

  it('resume los traslados de un vuelo', () => {
    expect(resumenTraslados([]).estado).toBe('SIN_TRASLADO');
    expect(resumenTraslados([{ status: 'SCHEDULED' }]).estado).toBe(
      'PENDIENTE',
    );
    expect(
      resumenTraslados([{ status: 'EN_ROUTE' }, { status: 'COMPLETED' }])
        .estado,
    ).toBe('EN_CURSO');
    expect(
      resumenTraslados([{ status: 'SCHEDULED' }, { status: 'COMPLETED' }]),
    ).toEqual({ total: 2, realizados: 1, enCurso: 0, estado: 'PARCIAL' });
    expect(
      resumenTraslados([{ status: 'COMPLETED' }, { status: 'CANCELLED' }])
        .estado,
    ).toBe('REALIZADO');
  });

  it('encuentra el Transfer In de Sergio Alvarenga por pasajero o por número de vuelo del mismo día', () => {
    const vuelo = {
      flightNumber: 'LA1324',
      arrivalTime: '2026-09-28T17:15:00.000Z',
    };
    const viajes = [
      {
        id: 'por-pasajero',
        tripType: 'TRANSFER_IN',
        status: 'SCHEDULED',
        requesterAthleteId: 'sergio',
      },
      {
        id: 'por-vuelo',
        tripType: 'TRANSFER_IN',
        status: 'SCHEDULED',
        metadata: {
          flightNumber: 'LA 1324',
          flightTime: '2026-09-28T17:15:00.000Z',
        },
      },
      {
        id: 'otro-dia',
        tripType: 'TRANSFER_IN',
        status: 'SCHEDULED',
        metadata: {
          flightNumber: 'LA1324',
          flightTime: '2026-09-30T17:15:00.000Z',
        },
      },
      {
        id: 'salida',
        tripType: 'TRANSFER_OUT',
        status: 'SCHEDULED',
        requesterAthleteId: 'sergio',
      },
      {
        id: 'cancelado',
        tripType: 'TRANSFER_IN',
        status: 'CANCELLED',
        requesterAthleteId: 'sergio',
      },
    ];
    expect(
      trasladosDelVuelo(vuelo, ['sergio'], viajes).map((v) => v.id),
    ).toEqual(['por-pasajero', 'por-vuelo']);
  });
});

describe('pasajeros de cada vuelo del Monitoreo de Llegadas', () => {
  // Caso del 15-10-2026: el LA715 de Brasil (30-09, René Zurita) y el de
  // México (15-10, Eduardo Pino) salían como dos filas iguales, cada una con
  // los 13 pasajeros y los dos conductores.
  const RUGBY = 'rugby';
  const brasil30 = {
    id: 'vuelo-30-09',
    eventId: RUGBY,
    flightNumber: 'LA715',
    arrivalTime: '2026-09-30T14:30:00.000Z',
  };
  const mexico15 = { ...brasil30, id: 'vuelo-15-10', arrivalTime: '2026-10-15T14:30:00.000Z' };
  const pasajeros = [
    { id: 'bra', eventId: RUGBY, flightNumber: 'LA715', arrivalFlightId: 'vuelo-30-09', arrivalTime: '2026-09-30T14:30:00.000Z' },
    { id: 'mex1', eventId: RUGBY, flightNumber: 'LA 715', arrivalFlightId: 'vuelo-15-10', arrivalTime: '2026-10-15T14:30:00.000Z' },
    { id: 'mex2', eventId: RUGBY, flightNumber: 'LA 715', arrivalFlightId: 'vuelo-15-10', arrivalTime: '2026-10-15T14:30:00.000Z' },
  ];
  const viajes = [
    { id: 't-bra', tripType: 'TRANSFER_IN', status: 'DROPPED_OFF', driverId: 'rene', requesterAthleteId: 'bra', scheduledAt: '2026-09-30T14:30:00.000Z', metadata: { flightNumber: 'LA715' } },
    { id: 't-mex1', tripType: 'TRANSFER_IN', status: 'SCHEDULED', driverId: 'eduardo', requesterAthleteId: 'mex1', scheduledAt: '2026-10-15T14:30:00.000Z', metadata: { flightNumber: 'LA715' } },
    { id: 't-mex2', tripType: 'TRANSFER_IN', status: 'SCHEDULED', driverId: 'eduardo', requesterAthleteId: 'mex2', scheduledAt: '2026-10-15T14:30:00.000Z', metadata: { flightNumber: 'LA715' } },
  ];
  const ids = (xs: Array<{ id: string }>) => xs.map((x) => x.id);

  it('cada vuelo trae solo sus pasajeros, sus traslados y su conductor', () => {
    const deBrasil = pasajerosDelVuelo(brasil30, pasajeros);
    const deMexico = pasajerosDelVuelo(mexico15, pasajeros);
    expect(ids(deBrasil)).toEqual(['bra']);
    expect(ids(deMexico)).toEqual(['mex1', 'mex2']);

    const trasladosMexico = trasladosDelVuelo(mexico15, ids(deMexico), viajes);
    expect(ids(trasladosMexico)).toEqual(['t-mex1', 't-mex2']);
    expect(new Set(trasladosMexico.map((v) => v.driverId))).toEqual(new Set(['eduardo']));
    expect(ids(trasladosDelVuelo(brasil30, ids(deBrasil), viajes))).toEqual(['t-bra']);
  });

  it('sin enlace al vuelo, cuenta el número y el día de llegada', () => {
    const sinEnlace = pasajeros.map((p) => ({ ...p, arrivalFlightId: null }));
    expect(ids(pasajerosDelVuelo(brasil30, sinEnlace))).toEqual(['bra']);
    expect(ids(pasajerosDelVuelo(mexico15, sinEnlace))).toEqual(['mex1', 'mex2']);
    // Sin hora en la ficha no hay cómo separarlas: sale en los dos días.
    const sinHora = [{ id: 'x', eventId: RUGBY, metadata: { vuelo_llegada: 'la715' } }];
    expect(ids(pasajerosDelVuelo(brasil30, sinHora))).toEqual(['x']);
    expect(ids(pasajerosDelVuelo(mexico15, sinHora))).toEqual(['x']);
  });

  it('el mismo número en otro evento no se mezcla', () => {
    const otroEvento = [{ ...pasajeros[1], eventId: 'jde', arrivalFlightId: null }];
    expect(pasajerosDelVuelo(mexico15, otroEvento)).toEqual([]);
  });
});
