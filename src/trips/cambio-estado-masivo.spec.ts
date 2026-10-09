import { BadRequestException } from '@nestjs/common';
import { aplicarCambioMasivo, validarCambioMasivo } from './cambio-estado-masivo';

const A = '3da7c9eb-d5bd-4c94-9b48-71311bf0c677';
const B = '5f32de8e-187e-402e-8cf2-de469b7ee81e';

describe('cambio de estado en lote', () => {
  it('acepta un estado permitido (en cualquier caja) e ids únicos', () => {
    expect(validarCambioMasivo({ ids: [A, B, A], status: 'en_route' })).toEqual({ ids: [A, B], status: 'EN_ROUTE' });
  });

  it('rechaza estados que no se cambian en lote, ids vacíos o inválidos y más de 500', () => {
    expect(() => validarCambioMasivo({ ids: [A], status: 'DROPPED_OFF' })).toThrow(BadRequestException);
    expect(() => validarCambioMasivo({ ids: [A], status: '' })).toThrow(/Estado no permitido/);
    expect(() => validarCambioMasivo({ ids: [], status: 'SCHEDULED' })).toThrow(/ids es obligatorio/);
    expect(() => validarCambioMasivo({ ids: ['viaje-1'], status: 'SCHEDULED' })).toThrow(/ids inválidos/);
    const muchos = Array.from({ length: 501 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
    expect(() => validarCambioMasivo({ ids: muchos, status: 'SCHEDULED' })).toThrow(/Máximo 500/);
  });

  it('cambia cada viaje y un fallo no detiene a los demás', async () => {
    const cambiados: string[] = [];
    const r = await aplicarCambioMasivo([A, B, 'malo'], async (id) => {
      if (id === 'malo') throw new Error('Trip not found');
      cambiados.push(id);
    }, 2);
    expect(cambiados).toEqual([A, B]);
    expect(r).toEqual({ requestedCount: 3, updatedCount: 2, errores: [{ id: 'malo', mensaje: 'Trip not found' }] });
  });
});
