import { normalizarNombrePersona } from './nombre-propio';

/** 28-09-2026: fichas de World Rugby cargadas en mayúsculas. */
describe('normalizarNombrePersona', () => {
  it('lo escrito en mayúsculas queda con la inicial en mayúscula', () => {
    expect(normalizarNombrePersona('VICTOR MANUEL GONZÁLEZ SILVA')).toBe('Victor Manuel González Silva');
    expect(normalizarNombrePersona('SERGIO ALVARENGA')).toBe('Sergio Alvarenga');
    expect(normalizarNombrePersona('FERNANDO GINZO')).toBe('Fernando Ginzo');
  });

  it('también lo escrito en minúsculas, con partículas y compuestos', () => {
    expect(normalizarNombrePersona('juana de los ríos pérez-soto')).toBe('Juana de los Ríos Pérez-Soto');
  });

  it('un nombre ya escrito con su forma no se toca', () => {
    expect(normalizarNombrePersona('Victoria Alexandra Alvear Merino')).toBe('Victoria Alexandra Alvear Merino');
    expect(normalizarNombrePersona('Ronald McDonald')).toBe('Ronald McDonald');
  });

  it('limpia los espacios de más', () => {
    expect(normalizarNombrePersona('  Salvador Alejandro Aedo Hernandez ')).toBe('Salvador Alejandro Aedo Hernandez');
  });
});
