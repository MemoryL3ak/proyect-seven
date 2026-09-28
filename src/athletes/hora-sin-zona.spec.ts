import { horaChileAIso } from './hora-sin-zona';

/** 28-09-2026: la hora del formulario de AND llegaba sin zona. */
describe('horaChileAIso', () => {
  it('sin zona es hora de Chile (verano, UTC-3)', () => {
    expect(horaChileAIso('2026-09-28T14:15')).toBe('2026-09-28T17:15:00.000Z');
  });
  it('en invierno Chile es UTC-4', () => {
    expect(horaChileAIso('2026-07-01T10:00')).toBe('2026-07-01T14:00:00.000Z');
  });
  it('una hora con zona no se toca', () => {
    expect(horaChileAIso('2026-09-28T17:15:00.000Z')).toBe(
      '2026-09-28T17:15:00.000Z',
    );
  });
  it('vacío y null se respetan', () => {
    expect(horaChileAIso(null)).toBeNull();
    expect(horaChileAIso(undefined)).toBeUndefined();
  });
});
