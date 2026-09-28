import { BadRequestException } from '@nestjs/common';
import { AthletesService } from './athletes.service';

/**
 * 28-09-2026: el vuelo H2 1811 de Fernando Ginzo salía "Sin traslado" en el
 * Monitoreo de Llegadas (su ficha era anterior a los traslados de AND). El
 * monitor ahora puede crearlo: sincroniza la ficha y devuelve sus traslados,
 * o explica por qué la ficha no genera ninguno.
 */
describe('AthletesService.crearTraslados', () => {
  function build(viajes: Array<{ id: string; clave: string; status: string }>) {
    const svc = Object.create(AthletesService.prototype) as AthletesService;
    const sincronizar = jest.fn(() => Promise.resolve());
    const query = jest.fn(() => Promise.resolve(viajes));
    Object.assign(svc, {
      trasladosAnd: { sincronizar },
      dataSource: { query },
    });
    return { svc, sincronizar, query };
  }

  it('sincroniza la ficha y devuelve sus traslados', async () => {
    const viajes = [
      { id: 'in', clave: 'and:ginzo:LLEGADA', status: 'SCHEDULED' },
      { id: 'out', clave: 'and:ginzo:SALIDA', status: 'SCHEDULED' },
    ];
    const { svc, sincronizar, query } = build(viajes);
    await expect(svc.crearTraslados('ginzo')).resolves.toEqual(viajes);
    expect(sincronizar).toHaveBeenCalledWith('ginzo');
    expect(query.mock.calls[0]).toEqual([expect.any(String), ['and:ginzo:%']]);
  });

  it('sin vuelo con hora no hay traslado: lo dice en vez de quedar callado', async () => {
    const { svc } = build([]);
    await expect(svc.crearTraslados('sin-vuelo')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
