/**
 * Protocolo GT06 (Concox / Jimi y sus clones), el que hablan los rastreadores
 * OBD como el G500LS (09-10-2026): la lista de comandos SMS del manual
 * (SERVER, APN, TIMER, GMT, PARAM#, WHERE#, SENALM) es la de esa familia.
 *
 * Trama corta:  78 78 | largo (1) | protocolo (1) | contenido | serie (2) | CRC (2) | 0D 0A
 * Trama larga:  79 79 | largo (2) | protocolo (1) | contenido | serie (2) | CRC (2) | 0D 0A
 * El largo cuenta desde el protocolo hasta el CRC inclusive. El CRC es
 * CRC-16/X-25 (ITU) sobre largo + protocolo + contenido + serie.
 *
 * Sólo se decodifica lo que el panel necesita: el IMEI del login y el bloque
 * GPS (fecha, satélites, lat, lng, velocidad, rumbo) que todos los paquetes
 * de posición y alarma traen al comienzo del contenido. Lo demás (LBS,
 * estado del terminal, kilometraje) se ignora.
 */

export type TramaGt06 = {
  /** Trama completa tal cual llegó (para registrar y depurar). */
  cruda: Buffer;
  protocolo: number;
  contenido: Buffer;
  serie: number;
  crcOk: boolean;
};

export type PosicionGt06 = {
  /** Hora que reporta el equipo (se asume UTC). */
  fecha: Date;
  satelites: number;
  lat: number;
  lng: number;
  /** km/h */
  velocidad: number;
  /** grados, 0–359 */
  rumbo: number;
  /** Bit "posicionado" del equipo: sin él la lat/lng es la última conocida. */
  valido: boolean;
};

export type MensajeGt06 =
  | { tipo: 'login'; imei: string; trama: TramaGt06 }
  | { tipo: 'latido'; trama: TramaGt06 }
  | { tipo: 'posicion'; posicion: PosicionGt06 | null; alarma: boolean; trama: TramaGt06 }
  | { tipo: 'hora'; trama: TramaGt06 }
  /** Respuesta del equipo a un comando en línea (0x80): el mismo texto que contestaría por SMS. */
  | { tipo: 'respuesta'; texto: string; trama: TramaGt06 }
  | { tipo: 'otro'; trama: TramaGt06 };

export const PROTOCOLO = {
  LOGIN: 0x01,
  LATIDO: 0x13,
  LATIDO_2: 0x23,
  COMANDO: 0x80,
  RESPUESTA_COMANDO: 0x15,
  RESPUESTA_COMANDO_2: 0x21,
  HORA: 0x8a,
} as const;

/** Paquetes cuyo contenido empieza con el bloque GPS de 18 bytes. */
const CON_GPS = new Set([0x10, 0x11, 0x12, 0x16, 0x1a, 0x22, 0x26, 0x27, 0x32, 0x33, 0x34, 0x37, 0xa0, 0xa1, 0xa4]);
const ALARMAS = new Set([0x16, 0x26, 0x27, 0xa4]);

/** CRC-16/X-25: polinomio 0x8408 reflejado, inicial 0xFFFF, complementado al final. */
export function crcItu(datos: Buffer): number {
  let crc = 0xffff;
  for (const byte of datos) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0x8408 : crc >>> 1;
    }
  }
  return ~crc & 0xffff;
}

/**
 * Separa las tramas completas que hay al comienzo de `buf`. Devuelve las
 * tramas y lo que sobra (una trama a medias, que se completa con el próximo
 * paquete TCP). Los bytes que no empiezan con 78 78 / 79 79 se descartan
 * hasta el próximo comienzo, y se informan como `basura` para registrarlos.
 */
export function separarTramas(buf: Buffer): { tramas: TramaGt06[]; resto: Buffer; basura: Buffer[] } {
  const tramas: TramaGt06[] = [];
  const basura: Buffer[] = [];
  let i = 0;
  while (i < buf.length) {
    const corta = buf[i] === 0x78 && buf[i + 1] === 0x78;
    const larga = buf[i] === 0x79 && buf[i + 1] === 0x79;
    if (!corta && !larga) {
      // Busca el próximo comienzo; lo anterior no es GT06.
      let j = i + 1;
      while (j < buf.length && !((buf[j] === 0x78 && buf[j + 1] === 0x78) || (buf[j] === 0x79 && buf[j + 1] === 0x79))) j++;
      basura.push(buf.subarray(i, j));
      i = j;
      continue;
    }
    const cabecera = corta ? 3 : 4; // 2 de inicio + largo (1 o 2)
    if (buf.length < i + cabecera) break;
    const largo = corta ? buf[i + 2] : buf.readUInt16BE(i + 2);
    const total = cabecera + largo + 2; // + 0D 0A
    if (buf.length < i + total) break;
    const cruda = buf.subarray(i, i + total);
    const protocolo = cruda[cabecera];
    const contenido = cruda.subarray(cabecera + 1, cabecera + largo - 4);
    const serie = cruda.readUInt16BE(cabecera + largo - 4);
    const crc = cruda.readUInt16BE(cabecera + largo - 2);
    const crcOk = crcItu(cruda.subarray(corta ? 2 : 2, cabecera + largo - 2)) === crc;
    tramas.push({ cruda: Buffer.from(cruda), protocolo, contenido: Buffer.from(contenido), serie, crcOk });
    i += total;
  }
  return { tramas, resto: Buffer.from(buf.subarray(i)), basura };
}

/** IMEI de 15 dígitos en 8 bytes BCD (el primer nibble es relleno). */
export function imeiDeBcd(bytes: Buffer): string {
  let s = '';
  for (const b of bytes) s += (b >> 4).toString(16) + (b & 0x0f).toString(16);
  return s.replace(/^0/, '');
}

/** Bloque GPS de 18 bytes al comienzo del contenido. */
export function decodificarGps(contenido: Buffer): PosicionGt06 | null {
  if (contenido.length < 18) return null;
  const anio = 2000 + contenido[0];
  const mes = contenido[1];
  const dia = contenido[2];
  const hora = contenido[3];
  const minuto = contenido[4];
  const segundo = contenido[5];
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || hora > 23 || minuto > 59 || segundo > 59) return null;
  const fecha = new Date(Date.UTC(anio, mes - 1, dia, hora, minuto, segundo));
  const satelites = contenido[6] & 0x0f;
  const latCruda = contenido.readUInt32BE(7) / 1800000;
  const lngCruda = contenido.readUInt32BE(11) / 1800000;
  const velocidad = contenido[15];
  const estado = contenido[16];
  const rumbo = ((estado & 0x03) << 8) | contenido[17];
  const valido = (estado & 0x10) !== 0;
  const norte = (estado & 0x04) !== 0;
  const oeste = (estado & 0x08) !== 0;
  const lat = norte ? latCruda : -latCruda;
  const lng = oeste ? -lngCruda : lngCruda;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { fecha, satelites, lat, lng, velocidad, rumbo, valido };
}

/**
 * Comando en línea al equipo (0x80): el mismo texto de los comandos SMS
 * (PARAM#, WHERE#, TIMER,10,60#) pero por el socket, sin depender de que
 * la SIM pueda mandar o recibir SMS. Contenido: largo (4 + texto), marca
 * del servidor (4 bytes, el equipo la devuelve en la respuesta) y el texto
 * en ASCII. El equipo contesta con 0x15 (o 0x21).
 */
export function comandoEnLinea(texto: string, serie: number, marca = 0): Buffer {
  const cmd = Buffer.from(texto, 'ascii');
  const contenido = Buffer.concat([
    Buffer.from([4 + cmd.length, (marca >>> 24) & 0xff, (marca >>> 16) & 0xff, (marca >>> 8) & 0xff, marca & 0xff]),
    cmd,
    // Idioma de la respuesta (0x0001 inglés): los firmwares nuevos lo
    // esperan después del texto; el largo del comando no lo cuenta.
    Buffer.from([0x00, 0x01]),
  ]);
  return respuesta(PROTOCOLO.COMANDO, serie, contenido);
}

/** Texto de la respuesta a un comando (0x15 / 0x21): después del largo y la marca del servidor. */
export function textoDeRespuesta(contenido: Buffer): string {
  if (contenido.length < 5) return '';
  const largo = contenido[0];
  const texto = contenido.subarray(5, Math.min(contenido.length, 5 + Math.max(0, largo - 4)));
  return texto.toString('latin1').replace(/[^\x20-\x7e\r\n]/g, '').trim();
}

export function interpretar(trama: TramaGt06): MensajeGt06 {
  const { protocolo, contenido } = trama;
  if (protocolo === PROTOCOLO.LOGIN) {
    return { tipo: 'login', imei: imeiDeBcd(contenido.subarray(0, 8)), trama };
  }
  if (protocolo === PROTOCOLO.LATIDO || protocolo === PROTOCOLO.LATIDO_2) return { tipo: 'latido', trama };
  if (protocolo === PROTOCOLO.HORA) return { tipo: 'hora', trama };
  if (protocolo === PROTOCOLO.RESPUESTA_COMANDO || protocolo === PROTOCOLO.RESPUESTA_COMANDO_2) {
    return { tipo: 'respuesta', texto: textoDeRespuesta(contenido), trama };
  }
  if (CON_GPS.has(protocolo)) {
    return { tipo: 'posicion', posicion: decodificarGps(contenido), alarma: ALARMAS.has(protocolo), trama };
  }
  return { tipo: 'otro', trama };
}

/** Respuesta corta del servidor: mismo protocolo y serie, sin contenido. */
export function respuesta(protocolo: number, serie: number, contenido: Buffer = Buffer.alloc(0)): Buffer {
  const largo = 1 + contenido.length + 2 + 2;
  const cuerpo = Buffer.concat([Buffer.from([largo, protocolo]), contenido, Buffer.from([(serie >> 8) & 0xff, serie & 0xff])]);
  const crc = crcItu(cuerpo);
  return Buffer.concat([Buffer.from([0x78, 0x78]), cuerpo, Buffer.from([(crc >> 8) & 0xff, crc & 0xff, 0x0d, 0x0a])]);
}

/** Respuesta a la petición de hora (0x8A): fecha UTC del servidor. */
export function respuestaHora(serie: number, ahora = new Date()): Buffer {
  const c = Buffer.from([
    ahora.getUTCFullYear() - 2000,
    ahora.getUTCMonth() + 1,
    ahora.getUTCDate(),
    ahora.getUTCHours(),
    ahora.getUTCMinutes(),
    ahora.getUTCSeconds(),
  ]);
  return respuesta(PROTOCOLO.HORA, serie, c);
}

/**
 * Qué contestar a cada mensaje. Login, latido y hora exigen respuesta (sin
 * ella el equipo corta y vuelve a conectar); a las posiciones se les
 * contesta igual, que es lo que esperan varios clones.
 */
export function respuestaPara(m: MensajeGt06, ahora = new Date()): Buffer | null {
  if (m.tipo === 'hora') return respuestaHora(m.trama.serie, ahora);
  if (m.tipo === 'otro' || m.tipo === 'respuesta') return null;
  return respuesta(m.trama.protocolo, m.trama.serie);
}
