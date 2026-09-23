import {
  esFalloDeRed,
  fetchConReintento,
  REINTENTOS_LECTURA,
} from './fetch-con-reintento';

const falloDeRed = () =>
  Object.assign(new TypeError('fetch failed'), {
    cause: { code: 'ECONNRESET' },
  });
const respuesta = () => ({ ok: true, status: 200 }) as unknown as Response;

describe('fetchConReintento', () => {
  it('una lectura que falla por red se repite y sale bien al segundo intento', async () => {
    let llamadas = 0;
    const base = jest.fn(() => {
      llamadas += 1;
      return llamadas === 1
        ? Promise.reject(falloDeRed())
        : Promise.resolve(respuesta());
    });
    const f = fetchConReintento(base as unknown as typeof fetch, [0, 0]);
    const r = await f('https://x/rest/v1/trips?select=id', { method: 'GET' });
    expect(r.status).toBe(200);
    expect(llamadas).toBe(2);
  });

  it('si la red sigue caída se rinde tras los reintentos y devuelve el mismo error', async () => {
    const base = jest.fn(() => Promise.reject(falloDeRed()));
    const f = fetchConReintento(base as unknown as typeof fetch, [0, 0]);
    await expect(f('https://x/rest/v1/trips')).rejects.toThrow('fetch failed');
    expect(base).toHaveBeenCalledTimes(REINTENTOS_LECTURA + 1);
  });

  it('una escritura no se repite: podría duplicar el dato', async () => {
    const base = jest.fn(() => Promise.reject(falloDeRed()));
    const f = fetchConReintento(base as unknown as typeof fetch, [0, 0]);
    await expect(
      f('https://x/rest/v1/trips', { method: 'POST', body: '{}' }),
    ).rejects.toThrow('fetch failed');
    expect(base).toHaveBeenCalledTimes(1);
  });

  it('un error que no es de red tampoco se repite', async () => {
    const base = jest.fn(() =>
      Promise.reject(new Error('AbortError: cancelado')),
    );
    const f = fetchConReintento(base as unknown as typeof fetch, [0, 0]);
    await expect(f('https://x/rest/v1/trips')).rejects.toThrow('cancelado');
    expect(base).toHaveBeenCalledTimes(1);
  });

  it('reconoce los fallos de red', () => {
    expect(esFalloDeRed(falloDeRed())).toBe(true);
    expect(esFalloDeRed(new Error('socket hang up'))).toBe(true);
    expect(esFalloDeRed(new Error('Código inválido'))).toBe(false);
    expect(esFalloDeRed(null)).toBe(false);
  });
});
