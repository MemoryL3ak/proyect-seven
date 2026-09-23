import { consultarPorLotes, enLotes } from './en-lotes';

describe('enLotes', () => {
  it('parte una lista larga en lotes del tamaño pedido', () => {
    const ids = Array.from({ length: 467 }, (_, i) => `id-${i}`);
    const lotes = enLotes(ids, 100);
    expect(lotes.map((l) => l.length)).toEqual([100, 100, 100, 100, 67]);
    expect(lotes.flat()).toEqual(ids);
  });

  it('una lista corta es un solo lote y una vacía ninguno', () => {
    expect(enLotes([1, 2, 3], 100)).toEqual([[1, 2, 3]]);
    expect(enLotes([], 100)).toEqual([]);
  });
});

describe('consultarPorLotes', () => {
  it('467 viajes se consultan en 5 lotes y las filas se juntan (antes la URL reventaba)', async () => {
    const ids = Array.from({ length: 467 }, (_, i) => `t-${i}`);
    const llamadas: number[] = [];
    const r = await consultarPorLotes(ids, (lote) => {
      llamadas.push(lote.length);
      return Promise.resolve({
        data: lote.map((id) => ({ trip_id: id })),
        error: null,
      });
    });
    expect(llamadas).toEqual([100, 100, 100, 100, 67]);
    expect(r.error).toBeNull();
    expect(r.data).toHaveLength(467);
  });

  it('quita los ids repetidos antes de consultar y sin ids no consulta', async () => {
    const consulta = jest.fn((lote: string[]) =>
      Promise.resolve({ data: lote.map((id) => ({ id })), error: null }),
    );
    const r = await consultarPorLotes(['a', 'a', 'b'], consulta);
    expect(consulta).toHaveBeenCalledTimes(1);
    expect(r.data).toHaveLength(2);
    expect((await consultarPorLotes([], consulta)).data).toEqual([]);
    expect(consulta).toHaveBeenCalledTimes(1);
  });

  it('si un lote falla, se devuelve ese error', async () => {
    const r = await consultarPorLotes(
      ['a', 'b'],
      (lote) =>
        Promise.resolve(
          lote[0] === 'b'
            ? { data: null, error: { message: 'se cayó' } }
            : { data: [{ id: 'a' }], error: null },
        ),
      1,
    );
    expect(r.error?.message).toBe('se cayó');
  });
});
