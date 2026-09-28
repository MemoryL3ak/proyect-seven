import { describe, expect, it } from 'vitest';
import {
  estadoAlMarcar,
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
