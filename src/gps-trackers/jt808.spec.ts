import { construirTrama, corregirHora, decodificarPosicionJt808, escapar, desescapar, interpretarJt808, MSG, respuestaParaJt808, separarTramasJt808 } from './jt808';

/** Registro real del SEG-9888G de Ariel (11-10-2026, 01:18), tal como llegó. */
const REGISTRO = Buffer.from('7e0100002d019210285072000e0000000037303131325345472d3938383847000000000000000000000030323835303732003130323835303732957e', 'hex');
const AHORA = new Date('2026-10-11T04:20:00Z');

const bcd = (n: number) => ((Math.floor(n / 10) << 4) | n % 10) & 0xff;
const cuerpoPosicion = (p: { lat: number; lng: number; vel: number; rumbo: number; horaUtc: Date; valido?: boolean; sats?: number }) => {
  const b = Buffer.alloc(28);
  b.writeUInt32BE(0, 0); // alarma
  const estado = ((p.valido ?? true) ? 0x02 : 0) | (p.lat < 0 ? 0x04 : 0) | (p.lng < 0 ? 0x08 : 0) | 0x01;
  b.writeUInt32BE(estado, 4);
  b.writeUInt32BE(Math.round(Math.abs(p.lat) * 1e6), 8);
  b.writeUInt32BE(Math.round(Math.abs(p.lng) * 1e6), 12);
  b.writeUInt16BE(520, 16); // altura
  b.writeUInt16BE(Math.round(p.vel * 10), 18);
  b.writeUInt16BE(p.rumbo, 20);
  // Hora de Pekín (UTC+8), como manda la norma.
  const pk = new Date(p.horaUtc.getTime() + 8 * 3_600_000);
  Buffer.from([bcd(pk.getUTCFullYear() - 2000), bcd(pk.getUTCMonth() + 1), bcd(pk.getUTCDate()), bcd(pk.getUTCHours()), bcd(pk.getUTCMinutes()), bcd(pk.getUTCSeconds())]).copy(b, 22);
  const extras = p.sats ? Buffer.from([0x31, 0x01, p.sats]) : Buffer.alloc(0);
  return Buffer.concat([b, extras]);
};

describe('JT808', () => {
  it('lee el registro real: teléfono, fabricante, modelo SEG-9888G e id del equipo, con suma correcta', () => {
    const { tramas, resto, basura } = separarTramasJt808(REGISTRO);
    expect(resto.length).toBe(0);
    expect(basura).toEqual([]);
    expect(tramas).toHaveLength(1);
    const t = tramas[0];
    expect(t.msgId).toBe(MSG.REGISTRO);
    expect(t.telefono).toBe('019210285072');
    expect(t.serie).toBe(14);
    expect(t.sumaOk).toBe(true);
    const m = interpretarJt808(t, AHORA);
    expect(m.tipo).toBe('registro');
    if (m.tipo === 'registro') expect(m.registro).toEqual({ fabricante: '70112', modelo: 'SEG-9888G', terminalId: '0285072', placa: '10285072' });
    // Respuesta 0x8100: serie del registro, resultado 0 y código.
    const r = respuestaParaJt808(m, 1);
    const [rt] = separarTramasJt808(r).tramas;
    expect(rt.msgId).toBe(MSG.RESPUESTA_REGISTRO);
    expect(rt.telefono).toBe('019210285072');
    expect(rt.sumaOk).toBe(true);
    expect(rt.cuerpo.readUInt16BE(0)).toBe(14);
    expect(rt.cuerpo[2]).toBe(0);
    expect(rt.cuerpo.subarray(3).toString()).toBe('SEVEN');
  });

  it('separa dos tramas pegadas, tolera una a medias y descarta lo que no es JT808', () => {
    const t1 = construirTrama(MSG.LATIDO, Buffer.from('019210285072', 'hex'), 5, Buffer.alloc(0));
    const todo = Buffer.concat([Buffer.from('basura'), t1, REGISTRO.subarray(0, 20)]);
    const r = separarTramasJt808(todo);
    expect(r.basura.map((b) => b.toString())).toEqual(['basura']);
    expect(r.tramas.map((t) => t.msgId)).toEqual([MSG.LATIDO]);
    expect(r.resto).toEqual(REGISTRO.subarray(0, 20));
    const r2 = separarTramasJt808(Buffer.concat([r.resto, REGISTRO.subarray(20)]));
    expect(r2.tramas.map((t) => t.msgId)).toEqual([MSG.REGISTRO]);
  });

  it('escapa 7E y 7D dentro de la trama y los recupera', () => {
    const cuerpo = Buffer.from([0x7e, 0x7d, 0x01, 0x02]);
    expect(desescapar(escapar(cuerpo))).toEqual(cuerpo);
    const t = construirTrama(0x0200, Buffer.from('019210285072', 'hex'), 9, cuerpo);
    expect(t.subarray(1, -1).includes(0x7e)).toBe(false);
    const [v] = separarTramasJt808(t).tramas;
    expect(v.cuerpo).toEqual(cuerpo);
    expect(v.sumaOk).toBe(true);
  });

  it('una posición en Santiago con hora de Pekín vuelve en UTC, con velocidad en km/h y satélites', () => {
    const horaUtc = new Date('2026-10-11T04:18:43Z');
    const cuerpo = cuerpoPosicion({ lat: -33.4543, lng: -70.5186, vel: 42.5, rumbo: 143, horaUtc, sats: 11 });
    const t = construirTrama(MSG.POSICION, Buffer.from('019210285072', 'hex'), 20, cuerpo);
    const m = interpretarJt808(separarTramasJt808(t).tramas[0], AHORA);
    expect(m.tipo).toBe('posicion');
    if (m.tipo !== 'posicion') return;
    expect(m.posicion).toMatchObject({ satelites: 11, velocidad: 42.5, rumbo: 143, valido: true });
    expect(m.posicion?.lat).toBeCloseTo(-33.4543, 5);
    expect(m.posicion?.lng).toBeCloseTo(-70.5186, 5);
    expect(m.posicion?.fecha.toISOString()).toBe('2026-10-11T04:18:43.000Z');
    // Se contesta con 0x8001 citando serie e id del mensaje.
    const r = separarTramasJt808(respuestaParaJt808(m, 2)).tramas[0];
    expect(r.msgId).toBe(MSG.RESPUESTA_GENERAL);
    expect(r.cuerpo).toEqual(Buffer.from([0, 20, 0x02, 0x00, 0]));
  });

  it('si el equipo manda la hora en UTC o local, se corrige al desfase entero más cercano', () => {
    const ahora = new Date('2026-10-11T04:20:00Z');
    expect(corregirHora(new Date('2026-10-11T12:19:30Z'), ahora).toISOString()).toBe('2026-10-11T04:19:30.000Z'); // Pekín
    expect(corregirHora(new Date('2026-10-11T04:19:30Z'), ahora).toISOString()).toBe('2026-10-11T04:19:30.000Z'); // UTC
    expect(corregirHora(new Date('2026-10-11T01:19:30Z'), ahora).toISOString()).toBe('2026-10-11T04:19:30.000Z'); // hora de Chile
    // Una posición acumulada de hace 40 minutos no se "corrige".
    expect(corregirHora(new Date('2026-10-11T03:40:00Z'), ahora).toISOString()).toBe('2026-10-11T03:40:00.000Z');
  });

  it('varias posiciones juntas (0x0704) y una sin fijo satelital', () => {
    const a = cuerpoPosicion({ lat: -33.45, lng: -70.52, vel: 10, rumbo: 90, horaUtc: new Date('2026-10-11T04:10:00Z') });
    const b = cuerpoPosicion({ lat: -33.46, lng: -70.53, vel: 12, rumbo: 95, horaUtc: new Date('2026-10-11T04:11:00Z'), valido: false });
    const cuerpo = Buffer.concat([Buffer.from([0, 2, 1]), Buffer.from([0, a.length]), a, Buffer.from([0, b.length]), b]);
    const m = interpretarJt808(separarTramasJt808(construirTrama(MSG.POSICIONES, Buffer.from('019210285072', 'hex'), 3, cuerpo)).tramas[0], AHORA);
    expect(m.tipo).toBe('posiciones');
    if (m.tipo !== 'posiciones') return;
    expect(m.posiciones).toHaveLength(2);
    expect(m.posiciones[0].valido).toBe(true);
    expect(m.posiciones[1].valido).toBe(false);
    expect(decodificarPosicionJt808(Buffer.alloc(10))).toBeNull();
  });
});
