import { eventoDriversCondition } from '../shared/evento-conductores';
import {
  devolverPersonaAlEvento,
  eventosDePersona,
  excluidaDelEvento,
  quitarPersonaDelEvento,
} from './eventos-persona';

/**
 * 28-09-2026: ALEX AREVALO trabaja en los Juegos Escolares y en World Rugby.
 * Para dejar en Rugby sólo a dos de sus 11 conductores, Ariel borró a los
 * otros con la papelera y salieron también de los Juegos Escolares, con 22
 * viajes hechos. Quitar de un evento no borra a nadie.
 */
const JDE = '0e168c10-a7d1-47ae-9784-265a5fc25d9d';
const RUGBY = '8bbd6a39-a788-4588-9c15-7aec86080dba';
const AREVALO = [JDE, RUGBY];

describe('personas quitadas de un evento', () => {
  it('Armando Soza sale de Rugby y sigue en los Juegos Escolares', () => {
    const r = quitarPersonaDelEvento(
      AREVALO,
      { isDriver: true, vehiclePatente: 'AB1234' },
      RUGBY,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.metadata).toMatchObject({
      isDriver: true,
      vehiclePatente: 'AB1234',
      eventosExcluidos: [RUGBY],
    });
    expect(eventosDePersona(AREVALO, r.metadata)).toEqual([JDE]);
    expect(excluidaDelEvento(r.metadata, RUGBY)).toBe(true);
    expect(excluidaDelEvento(r.metadata, JDE)).toBe(false);
  });

  it('no se puede quitar del último evento que le queda: eso es eliminarla', () => {
    const r = quitarPersonaDelEvento([RUGBY], {}, RUGBY);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toMatch(/eliminarla/);
    const yaFueraDeJde = { eventosExcluidos: [JDE] };
    expect(quitarPersonaDelEvento(AREVALO, yaFueraDeJde, RUGBY).ok).toBe(false);
  });

  it('un proveedor sin eventos (se ve en todos) no permite quitar', () => {
    expect(quitarPersonaDelEvento([], {}, RUGBY).ok).toBe(false);
  });

  it('devolverla al evento limpia la marca', () => {
    expect(
      devolverPersonaAlEvento(
        { isDriver: true, eventosExcluidos: [RUGBY] },
        RUGBY,
      ),
    ).toEqual({ isDriver: true });
    expect(
      devolverPersonaAlEvento({ eventosExcluidos: [RUGBY, JDE] }, RUGBY),
    ).toEqual({ eventosExcluidos: [JDE] });
    expect(devolverPersonaAlEvento({ isDriver: true }, RUGBY)).toBeNull();
  });

  it('Monitoreo de Conductores descarta a los quitados del evento', () => {
    expect(eventoDriversCondition('$3', 'd.id')).toContain(
      "coalesce(pp.metadata->'eventosExcluidos', '[]'::jsonb) @> jsonb_build_array($3::text)",
    );
  });
});
