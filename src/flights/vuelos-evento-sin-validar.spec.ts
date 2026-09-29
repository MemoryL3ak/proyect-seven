import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * 28-09-2026: la pestaña Vuelos de los coordinadores de BVAN mostraba un
 * vuelo de 14: /flights/evento sólo traía fichas validadas y las de AND
 * quedan REGISTERED. Ahora trae toda ficha no eliminada con vuelo.
 */
describe('GET /flights/evento: pasajeros validados o no', () => {
  const fuente = readFileSync(join(__dirname, 'flights.service.ts'), 'utf8');
  const consulta = fuente.slice(
    fuente.indexOf('async vuelosDelEvento'),
    fuente.indexOf('async trackFlight'),
  );

  it('no exige datos personales validados', () => {
    expect(consulta).not.toContain("'PERSONAL_DATA_VALIDATED'");
    expect(consulta).toContain("a.status is distinct from 'DELETED'");
  });

  it('trae teléfono y patente del conductor de cada tramo', () => {
    expect(consulta).toContain('telefono_conductor_llegada');
    expect(consulta).toContain('patente_salida');
  });
});
