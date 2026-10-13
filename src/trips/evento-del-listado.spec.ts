import { eventoDelListado } from './evento-del-listado';

const RUGBY = '8bbd6a39-a788-4588-9c15-7aec86080dba';
const JDE = '0e168c10-a7d1-47ae-9784-265a5fc25d9d';

describe('evento del listado de viajes', () => {
  it('el panel pide sólo los viajes del evento activo (antes bajaba los de todos, 4 MB cada 8 s)', () => {
    expect(eventoDelListado(null, RUGBY)).toBe(RUGBY);
    expect(eventoDelListado(null, ` ${JDE} `)).toBe(JDE);
  });

  it('sin evento pedido, como antes: todos', () => {
    expect(eventoDelListado(null, undefined)).toBeNull();
    expect(eventoDelListado(null, '')).toBeNull();
  });

  it('el evento del portal (Comité, Jefe de Misión) manda sobre la consulta: nunca se amplía lo que ve', () => {
    expect(eventoDelListado(JDE, RUGBY)).toBe(JDE);
    expect(eventoDelListado(JDE, undefined)).toBe(JDE);
  });

  it('un valor que no es uuid se ignora', () => {
    expect(eventoDelListado(null, "x' or 1=1")).toBeNull();
    expect(eventoDelListado(null, 'todos')).toBeNull();
  });
});
