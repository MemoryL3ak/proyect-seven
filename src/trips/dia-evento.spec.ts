import { diaEvento } from './dia-evento';

describe('diaEvento', () => {
  it('da el día en hora de Chile aunque en UTC ya sea el siguiente', () => {
    // 23:30 de Chile del 24-09 son las 02:30 UTC del 25-09.
    expect(diaEvento('2026-09-25T02:30:00.000Z')).toBe('2026-09-24');
    expect(diaEvento(new Date('2026-09-24T21:30:00.000Z'))).toBe('2026-09-24');
  });

  it('sin fecha válida no hay día', () => {
    expect(diaEvento(null)).toBeNull();
    expect(diaEvento('no es fecha')).toBeNull();
  });
});
