import { describe, expect, it } from 'vitest';
import {
  enEventosDelConductor,
  eventosDelConductor,
  enEventoElegido,
  eventosParaFiltro,
  viajesDelEventoElegido,
} from './eventos-conductor';

/** 28-09-2026: el conductor de Rugby veía las sedes y hoteles de los Juegos. */
describe('eventos del conductor', () => {
  it('los del proveedor, o el de la flota propia', () => {
    expect(eventosDelConductor({ eventIds: ['rugby'] })).toEqual(['rugby']);
    expect(eventosDelConductor({ eventIds: [], eventId: 'jde' })).toEqual([
      'jde',
    ]);
    expect(eventosDelConductor(null)).toEqual([]);
  });
  it('sólo lo de sus eventos; lo general se ve siempre', () => {
    expect(enEventosDelConductor(['rugby'], 'rugby')).toBe(true);
    expect(enEventosDelConductor(['rugby'], 'jde')).toBe(false);
    expect(enEventosDelConductor(['rugby'], null)).toBe(true);
  });
  it('sin eventos conocidos no se esconde nada', () => {
    expect(enEventosDelConductor([], 'jde')).toBe(true);
  });
});

/**
 * 28-09-2026: un conductor de ALEX AREVALO trabaja en los Juegos Escolares y
 * en World Rugby; la app le mostraba los dos eventos mezclados. Con más de
 * un evento tiene un filtro de evento.
 */
describe('filtro de evento del conductor', () => {
  const JDE = 'jde';
  const RUGBY = 'rugby';
  const viajes = [
    { id: 'v1', eventId: JDE },
    { id: 'v2', eventId: RUGBY },
    { id: 'v3', eventId: JDE },
  ];

  it('ofrece sus eventos y los de sus viajes, sin repetir', () => {
    expect(eventosParaFiltro([JDE, RUGBY], viajes)).toEqual([JDE, RUGBY]);
    expect(eventosParaFiltro([RUGBY], viajes)).toEqual([RUGBY, JDE]);
    expect(eventosParaFiltro([RUGBY], [])).toEqual([RUGBY]);
  });

  it('eligiendo Rugby, sólo los viajes, sedes y hoteles de Rugby', () => {
    expect(viajesDelEventoElegido(viajes, RUGBY).map((v) => v.id)).toEqual(['v2']);
    expect(enEventoElegido(RUGBY, [JDE, RUGBY], JDE)).toBe(false);
    expect(enEventoElegido(RUGBY, [JDE, RUGBY], RUGBY)).toBe(true);
    // Un documento general se ve igual.
    expect(enEventoElegido(RUGBY, [JDE, RUGBY], null)).toBe(true);
  });

  it('sin elegir, todo lo de sus eventos', () => {
    expect(viajesDelEventoElegido(viajes, '')).toHaveLength(3);
    expect(enEventoElegido('', [JDE, RUGBY], JDE)).toBe(true);
    expect(enEventoElegido('', [RUGBY], JDE)).toBe(false);
  });
});
