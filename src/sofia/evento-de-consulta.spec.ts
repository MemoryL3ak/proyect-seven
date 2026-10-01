import { eventoDeConsulta, eventoParaHerramienta } from './evento-de-consulta';

const JDE = '0e168c10-a7d1-47ae-9784-265a5fc25d9d';
const RUGBY = '8bbd6a39-a788-4588-9c15-7aec86080dba';

describe('evento de la consulta a SofIA', () => {
  it('una cuenta acotada a Rugby consulta Rugby aunque pida otro evento o ninguno', () => {
    // Claribel y Víctor (World Rugby) tienen eventIds = [Rugby].
    expect(eventoDeConsulta(RUGBY, [RUGBY])).toBe(RUGBY);
    expect(eventoDeConsulta(JDE, [RUGBY])).toBe(RUGBY);
    expect(eventoDeConsulta(null, [RUGBY])).toBe(RUGBY);
    expect(eventoDeConsulta('', [RUGBY])).toBe(RUGBY);
  });

  it('sin restricción manda el evento en pantalla; sin pantalla, nada', () => {
    expect(eventoDeConsulta(RUGBY, null)).toBe(RUGBY);
    expect(eventoDeConsulta(undefined, [])).toBeNull();
  });

  it('la herramienta recibe el evento de la consulta cuando el modelo no pone uno o pone uno prohibido', () => {
    const acotado = { actual: RUGBY, permitidos: [RUGBY] };
    expect(eventoParaHerramienta(undefined, acotado)).toBe(RUGBY);
    expect(eventoParaHerramienta('', acotado)).toBe(RUGBY);
    expect(eventoParaHerramienta(JDE, acotado)).toBe(RUGBY);
    expect(eventoParaHerramienta(RUGBY, acotado)).toBe(RUGBY);
  });

  it('un administrador en Rugby puede preguntar por los Juegos si lo nombra; si no, Rugby', () => {
    const libre = { actual: RUGBY, permitidos: null };
    expect(eventoParaHerramienta(JDE, libre)).toBe(JDE);
    expect(eventoParaHerramienta(undefined, libre)).toBe(RUGBY);
    // Sin contexto (portal sin evento), queda lo que puso el modelo.
    expect(eventoParaHerramienta(JDE, null)).toBe(JDE);
    expect(eventoParaHerramienta('  ', { actual: null, permitidos: null })).toBeNull();
  });
});
