import { comandoEnLinea, crcItu, decodificarGps, imeiDeBcd, interpretar, respuesta, respuestaPara, separarTramas, textoDeRespuesta, valeGuardar } from './gt06';

/**
 * El login y su respuesta son las tramas de ejemplo del documento oficial
 * del protocolo GT06 (Concox): fijan el CRC y el IMEI en BCD. Las tramas de
 * posición se arman acá con el diseño del bloque GPS (fecha, satélites,
 * lat/lng × 1 800 000, velocidad, rumbo y banderas), que es el mismo para
 * todos los paquetes de posición y alarma.
 */
const hex = (s: string) => Buffer.from(s.replace(/\s+/g, ''), 'hex');
const LOGIN = hex('78 78 0D 01 01 23 45 67 89 01 23 45 00 01 8C DD 0D 0A');
const LOGIN_RESPUESTA = hex('78 78 05 01 00 01 D9 DC 0D 0A');
const LATIDO = hex('78 78 0A 13 40 06 04 00 01 00 0F DC EE 0D 0A');

type Punto = { fecha: Date; sats: number; lat: number; lng: number; vel: number; rumbo: number; valido?: boolean };
const bloqueGps = (p: Punto): Buffer => {
  const b = Buffer.alloc(18);
  b[0] = p.fecha.getUTCFullYear() - 2000;
  b[1] = p.fecha.getUTCMonth() + 1;
  b[2] = p.fecha.getUTCDate();
  b[3] = p.fecha.getUTCHours();
  b[4] = p.fecha.getUTCMinutes();
  b[5] = p.fecha.getUTCSeconds();
  b[6] = 0xc0 | p.sats;
  b.writeUInt32BE(Math.round(Math.abs(p.lat) * 1800000), 7);
  b.writeUInt32BE(Math.round(Math.abs(p.lng) * 1800000), 11);
  b[15] = p.vel;
  const banderas = (p.rumbo & 0x3ff) | ((p.valido ?? true) ? 0x1000 : 0) | (p.lat >= 0 ? 0x0400 : 0) | (p.lng < 0 ? 0x0800 : 0);
  b.writeUInt16BE(banderas, 16);
  return b;
};
const LBS = Buffer.alloc(8); // MCC, MNC, LAC, Cell ID: se ignoran
const tramaPosicion = (protocolo: number, serie: number, p: Punto) => respuesta(protocolo, serie, Buffer.concat([bloqueGps(p), LBS]));
const SANTIAGO: Punto = { fecha: new Date('2026-10-09T15:04:05Z'), sats: 9, lat: -33.4543, lng: -70.5186, vel: 42, rumbo: 143 };

describe('GT06', () => {
  it('el CRC es el del documento (login)', () => {
    expect(crcItu(LOGIN.subarray(2, 14))).toBe(0x8cdd);
  });

  it('separa tramas, tolera una partida en dos paquetes y descarta lo que no es GT06', () => {
    const todo = Buffer.concat([Buffer.from('hola'), LOGIN, LATIDO.subarray(0, 5)]);
    const r = separarTramas(todo);
    expect(r.basura.map((b) => b.toString())).toEqual(['hola']);
    expect(r.tramas.map((t) => t.protocolo)).toEqual([0x01]);
    expect(r.tramas[0].crcOk).toBe(true);
    expect(r.resto).toEqual(LATIDO.subarray(0, 5));
    const r2 = separarTramas(Buffer.concat([r.resto, LATIDO.subarray(5)]));
    expect(r2.tramas.map((t) => t.protocolo)).toEqual([0x13]);
    expect(r2.resto.length).toBe(0);
  });

  it('el login trae el IMEI en BCD y se contesta con la trama del documento', () => {
    const [trama] = separarTramas(LOGIN).tramas;
    const m = interpretar(trama);
    expect(m.tipo).toBe('login');
    if (m.tipo === 'login') expect(m.imei).toBe('123456789012345');
    expect(respuestaPara(m)).toEqual(LOGIN_RESPUESTA);
    expect(imeiDeBcd(hex('08 65 70 16 81 73 75 00'))).toBe('865701681737500');
  });

  it('una posición en Santiago (sur y oeste) vuelve con sus valores y se contesta con la misma serie', () => {
    const [trama] = separarTramas(tramaPosicion(0x12, 3, SANTIAGO)).tramas;
    expect(trama.crcOk).toBe(true);
    const m = interpretar(trama);
    expect(m.tipo).toBe('posicion');
    if (m.tipo !== 'posicion') return;
    expect(m.posicion).toMatchObject({ satelites: 9, velocidad: 42, rumbo: 143, valido: true });
    expect(m.posicion?.fecha.toISOString()).toBe('2026-10-09T15:04:05.000Z');
    expect(m.posicion?.lat).toBeCloseTo(-33.4543, 5);
    expect(m.posicion?.lng).toBeCloseTo(-70.5186, 5);
    expect(m.alarma).toBe(false);
    expect(respuestaPara(m)).toEqual(respuesta(0x12, 3));
  });

  it('norte y este salen positivos; una alarma (0x26) trae la posición igual', () => {
    const p = { ...SANTIAGO, lat: 22.5557, lng: 114.4821 };
    const m = interpretar(separarTramas(tramaPosicion(0x26, 4, p)).tramas[0]);
    expect(m.tipo).toBe('posicion');
    if (m.tipo !== 'posicion') return;
    expect(m.alarma).toBe(true);
    expect(m.posicion?.lat).toBeCloseTo(22.5557, 5);
    expect(m.posicion?.lng).toBeCloseTo(114.4821, 5);
  });

  it('sin el bit "posicionado" la lectura queda marcada como no válida', () => {
    const p = decodificarGps(bloqueGps({ ...SANTIAGO, valido: false }));
    expect(p?.valido).toBe(false);
    expect(p?.lat).toBeCloseTo(-33.4543, 5);
  });

  it('un bloque GPS con fecha imposible no es una posición', () => {
    const bloque = bloqueGps(SANTIAGO);
    bloque[1] = 13;
    expect(decodificarGps(bloque)).toBeNull();
  });

  it('el latido y lo desconocido (0x94 de identificación) se contestan con su mismo protocolo y serie', () => {
    const [trama] = separarTramas(LATIDO).tramas;
    const m = interpretar(trama);
    expect(m.tipo).toBe('latido');
    expect(respuestaPara(m)).toEqual(respuesta(0x13, 0x000f));
    const desconocida = separarTramas(respuesta(0x94, 7)).tramas[0];
    expect(interpretar(desconocida).tipo).toBe('otro');
    expect(respuestaPara(interpretar(desconocida))).toEqual(respuesta(0x94, 7));
  });

  it('la petición de hora se contesta con la fecha UTC del servidor', () => {
    const [trama] = separarTramas(respuesta(0x8a, 2)).tramas;
    const r = respuestaPara(interpretar(trama), new Date('2026-10-09T15:04:05Z'));
    expect(r?.subarray(4, 10)).toEqual(Buffer.from([26, 10, 9, 15, 4, 5]));
  });

  it('un comando en línea (0x80) lleva largo, marca del servidor y el texto; la respuesta (0x15) devuelve el texto', () => {
    const c = comandoEnLinea('PARAM#', 9, 0x00000001);
    expect(c.subarray(0, 4)).toEqual(Buffer.from([0x78, 0x78, 1 + 1 + 4 + 6 + 2 + 4, 0x80])); // protocolo + largo + marca + texto + idioma + serie y CRC
    expect(c[4]).toBe(4 + 6); // largo del comando: marca + texto
    expect(c.subarray(5, 9)).toEqual(Buffer.from([0, 0, 0, 1]));
    expect(c.subarray(9, 15).toString('ascii')).toBe('PARAM#');
    expect(c.subarray(15, 17)).toEqual(Buffer.from([0x00, 0x01]));
    expect(separarTramas(c).tramas[0].crcOk).toBe(true);
    // Respuesta del equipo: 0x15 con largo, marca y texto, más idioma al final.
    const texto = Buffer.from('TIMER:10,60;', 'ascii');
    const contenido = Buffer.concat([Buffer.from([4 + texto.length, 0, 0, 0, 1]), texto, Buffer.from([0x00, 0x01])]);
    const m = interpretar(separarTramas(respuesta(0x15, 10, contenido)).tramas[0]);
    expect(m.tipo).toBe('respuesta');
    if (m.tipo === 'respuesta') expect(m.texto).toBe('TIMER:10,60;');
    expect(respuestaPara(m)).toBeNull();
    expect(textoDeRespuesta(Buffer.from([1]))).toBe('');
  });

  it('detenido se guarda una posición por minuto; en movimiento, cada 15 m; lo reenviado viejo no pisa lo nuevo', () => {
    const t0 = new Date('2026-10-09T17:29:14Z');
    const casa = { lat: -33.57856, lng: -70.7105, fecha: t0 };
    expect(valeGuardar(null, casa)).toBe(true);
    // 2 s después, sin moverse: no.
    expect(valeGuardar(casa, { ...casa, fecha: new Date(t0.getTime() + 2000) })).toBe(false);
    // 60 s después, sin moverse: sí (señal de vida).
    expect(valeGuardar(casa, { ...casa, fecha: new Date(t0.getTime() + 60000) })).toBe(true);
    // 2 s después, 20 m más al norte: sí.
    expect(valeGuardar(casa, { lat: -33.57838, lng: -70.7105, fecha: new Date(t0.getTime() + 2000) })).toBe(true);
    // Una posición acumulada de hace una hora, reenviada ahora: no pisa la actual.
    expect(valeGuardar(casa, { lat: -33.6, lng: -70.7, fecha: new Date(t0.getTime() - 3600000) })).toBe(false);
  });
});
