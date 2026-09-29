import { of, lastValueFrom } from 'rxjs';
import { ExecutionContext } from '@nestjs/common';
import { ocultaCobros, permisosDesdeMetadata, quitarCobrosDelCuerpo } from './permisos-panel';
import { SensitiveFieldsInterceptor } from './sensitive-fields.interceptor';

/**
 * 29-09-2026: "eso hay que sacar porque les aparece el costo del viaje y eso
 * es lo que cobramos nosotros". El Comité de World Rugby veía "Valor
 * $180.000" en el detalle del viaje. Sólo lo ven quienes tienen Finanzas.
 */
const comite = {
  type: 'staff',
  userId: 'victoria',
  permisos: permisosDesdeMetadata({
    modules: ['operacion.llegadas', 'operacion.salidas', 'operacion.viajes', 'operacion.solicitudes', 'calendario'],
    soloVer: ['operacion.llegadas', 'operacion.salidas', 'operacion.viajes', 'calendario'],
    eventIds: ['8bbd6a39-a788-4588-9c15-7aec86080dba'],
  }),
};
const bvan = {
  type: 'staff',
  userId: 'claribel',
  permisos: permisosDesdeMetadata({ modules: ['operacion.viajes', 'operacion.finanzas'], soloVer: [] }),
};
const admin = { type: 'staff', userId: 'ariel', permisos: permisosDesdeMetadata({}) };

const viaje = {
  id: 't1',
  origin: 'Aeropuerto',
  destination: 'Av. Ricardo Lyon 322',
  tripCost: 180000,
  returnTrip: { id: 't2', tripCost: 180000 },
};

async function respuestaPara(caller: unknown) {
  const ctx = { switchToHttp: () => ({ getRequest: () => ({ apiCaller: caller }) }) } as unknown as ExecutionContext;
  return lastValueFrom(new SensitiveFieldsInterceptor().intercept(ctx, { handle: () => of([viaje]) }));
}

describe('valor del viaje: sólo con Finanzas', () => {
  it('quién ve cobros', () => {
    expect(ocultaCobros(comite)).toBe(true);
    expect(ocultaCobros(bvan)).toBe(false);
    expect(ocultaCobros(admin)).toBe(false);
    expect(ocultaCobros({ type: 'portal', kind: 'driver' })).toBe(false);
    expect(ocultaCobros({ type: 'portal', kind: 'athlete' })).toBe(true);
    expect(ocultaCobros(null)).toBe(true);
  });

  it('al Comité no le llega el valor, ni en el tramo de regreso', async () => {
    expect(await respuestaPara(comite)).toEqual([
      { id: 't1', origin: 'Aeropuerto', destination: 'Av. Ricardo Lyon 322', returnTrip: { id: 't2' } },
    ]);
  });

  it('a BVAN y a los administradores sí', async () => {
    expect(await respuestaPara(bvan)).toEqual([viaje]);
    expect(await respuestaPara(admin)).toEqual([viaje]);
  });

  it('si el Comité guarda un viaje, el valor que venga en el cuerpo se ignora', () => {
    const cuerpo: Record<string, unknown> = { destination: 'Hotel Torremayor', tripCost: '' };
    quitarCobrosDelCuerpo(comite, cuerpo);
    expect(cuerpo).toEqual({ destination: 'Hotel Torremayor' });
    const deBvan: Record<string, unknown> = { tripCost: 150000 };
    quitarCobrosDelCuerpo(bvan, deBvan);
    expect(deBvan).toEqual({ tripCost: 150000 });
  });
});
