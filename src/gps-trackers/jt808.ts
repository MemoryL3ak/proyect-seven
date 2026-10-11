/**
 * Protocolo JT/T 808 (norma china de terminales vehiculares), el que habla
 * el OBD "SEG-9888G" de Ariel (11-10-2026): se registra con 0x0100, se
 * autentica con 0x0102, late con 0x0002 y reporta posición con 0x0200 (o
 * varias juntas con 0x0704 al recuperar señal).
 *
 * Trama: 7E | id mensaje (2) | atributos (2: bits 0-9 largo del cuerpo,
 * bit 13 subpaquete) | teléfono del terminal (6 bytes BCD) | serie (2) |
 * [subpaquete (4)] | cuerpo | suma (XOR de todo lo anterior salvo el 7E) | 7E.
 * Dentro de la trama, 0x7E se escribe 7D 02 y 0x7D se escribe 7D 01.
 */
import type { ExtrasVehiculo, PosicionGt06 } from './gt06';

export type TramaJt808 = {
  cruda: Buffer;
  msgId: number;
  telefono: string;
  telefonoBcd: Buffer;
  serie: number;
  cuerpo: Buffer;
  sumaOk: boolean;
  subpaquete: { total: number; indice: number } | null;
};

export type Registro = { fabricante: string; modelo: string; terminalId: string; placa: string };

export type MensajeJt808 =
  | { tipo: 'registro'; registro: Registro; trama: TramaJt808 }
  | { tipo: 'autenticacion'; codigo: string; trama: TramaJt808 }
  | { tipo: 'latido'; trama: TramaJt808 }
  | { tipo: 'posicion'; posicion: PosicionGt06 | null; trama: TramaJt808 }
  | { tipo: 'posiciones'; posiciones: PosicionGt06[]; trama: TramaJt808 }
  | { tipo: 'otro'; trama: TramaJt808 };

export const MSG = {
  RESPUESTA_GENERAL: 0x8001,
  LATIDO: 0x0002,
  BAJA: 0x0003,
  REGISTRO: 0x0100,
  RESPUESTA_REGISTRO: 0x8100,
  AUTENTICACION: 0x0102,
  POSICION: 0x0200,
  /** Del fabricante del SEG-9888G: una posición más al dar el contacto, con el mismo cuerpo que 0x0200. */
  POSICION_EVENTO: 0x0202,
  POSICIONES: 0x0704,
} as const;

export function desescapar(b: Buffer): Buffer {
  const out: number[] = [];
  for (let i = 0; i < b.length; i++) {
    if (b[i] === 0x7d && i + 1 < b.length) {
      if (b[i + 1] === 0x02) { out.push(0x7e); i++; continue; }
      if (b[i + 1] === 0x01) { out.push(0x7d); i++; continue; }
    }
    out.push(b[i]);
  }
  return Buffer.from(out);
}

export function escapar(b: Buffer): Buffer {
  const out: number[] = [];
  for (const x of b) {
    if (x === 0x7e) out.push(0x7d, 0x02);
    else if (x === 0x7d) out.push(0x7d, 0x01);
    else out.push(x);
  }
  return Buffer.from(out);
}

const xor = (b: Buffer) => b.reduce((a, x) => a ^ x, 0);

/** 6 bytes BCD → 12 dígitos ("019210285072"). */
export function telefonoDeBcd(b: Buffer): string {
  let s = '';
  for (const x of b) s += (x >> 4).toString(16) + (x & 0x0f).toString(16);
  return s;
}

function decodificarTrama(limpia: Buffer): TramaJt808 | null {
  if (limpia.length < 13) return null;
  const msgId = limpia.readUInt16BE(0);
  const atributos = limpia.readUInt16BE(2);
  const largoCuerpo = atributos & 0x03ff;
  const conSubpaquete = (atributos & 0x2000) !== 0;
  const telefonoBcd = Buffer.from(limpia.subarray(4, 10));
  const serie = limpia.readUInt16BE(10);
  let inicio = 12;
  let subpaquete: TramaJt808['subpaquete'] = null;
  if (conSubpaquete) {
    if (limpia.length < 17) return null;
    subpaquete = { total: limpia.readUInt16BE(12), indice: limpia.readUInt16BE(14) };
    inicio = 16;
  }
  const cuerpo = Buffer.from(limpia.subarray(inicio, inicio + largoCuerpo));
  const suma = limpia[limpia.length - 1];
  const sumaOk = xor(limpia.subarray(0, limpia.length - 1)) === suma;
  return { cruda: limpia, msgId, telefono: telefonoDeBcd(telefonoBcd), telefonoBcd, serie, cuerpo, sumaOk, subpaquete };
}

/**
 * Separa las tramas completas (7E … 7E) al comienzo del buffer. Lo que no
 * empieza con 7E se descarta como basura; una trama a medias queda en `resto`.
 */
export function separarTramasJt808(buf: Buffer): { tramas: TramaJt808[]; resto: Buffer; basura: Buffer[] } {
  const tramas: TramaJt808[] = [];
  const basura: Buffer[] = [];
  let i = 0;
  while (i < buf.length) {
    if (buf[i] !== 0x7e) {
      const j = buf.indexOf(0x7e, i);
      basura.push(buf.subarray(i, j < 0 ? buf.length : j));
      if (j < 0) { i = buf.length; break; }
      i = j;
      continue;
    }
    // 7E de inicio; puede venir pegado al 7E de cierre de la anterior.
    if (buf[i + 1] === 0x7e) { i++; continue; }
    const fin = buf.indexOf(0x7e, i + 1);
    if (fin < 0) break;
    const limpia = desescapar(buf.subarray(i + 1, fin));
    const t = decodificarTrama(limpia);
    if (t) tramas.push(t);
    else basura.push(buf.subarray(i, fin + 1));
    i = fin + 1;
  }
  return { tramas, resto: Buffer.from(buf.subarray(i)), basura };
}

const bcd2 = (b: number) => (b >> 4) * 10 + (b & 0x0f);

/**
 * Hora del equipo. La norma dice hora de Pekín (UTC+8), pero hay equipos que
 * mandan UTC u hora local: se toma el desfase en horas enteras que deje la
 * fecha más cerca del reloj del servidor (hasta 15 min de diferencia).
 */
export function corregirHora(fecha: Date, ahora: Date): Date {
  const deltaH = (fecha.getTime() - ahora.getTime()) / 3_600_000;
  const entero = Math.round(deltaH);
  if (Math.abs(deltaH - entero) <= 0.25 && Math.abs(entero) <= 14 && entero !== 0) {
    return new Date(fecha.getTime() - entero * 3_600_000);
  }
  return fecha;
}

/** Cuerpo de 0x0200: alarma(4) estado(4) lat(4) lng(4) altura(2) velocidad(2) rumbo(2) hora(6 BCD) + extras TLV. */
export function decodificarPosicionJt808(cuerpo: Buffer, ahora = new Date()): PosicionGt06 | null {
  if (cuerpo.length < 28) return null;
  const estado = cuerpo.readUInt32BE(4);
  let lat = cuerpo.readUInt32BE(8) / 1e6;
  let lng = cuerpo.readUInt32BE(12) / 1e6;
  if (estado & 0x04) lat = -lat;
  if (estado & 0x08) lng = -lng;
  const velocidad = cuerpo.readUInt16BE(18) / 10;
  const rumbo = cuerpo.readUInt16BE(20);
  const h = cuerpo.subarray(22, 28);
  const anio = 2000 + bcd2(h[0]);
  const mes = bcd2(h[1]);
  const dia = bcd2(h[2]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const fecha = corregirHora(new Date(Date.UTC(anio, mes - 1, dia, bcd2(h[3]), bcd2(h[4]), bcd2(h[5]))), ahora);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const { satelites, extras } = leerExtras(cuerpo.subarray(28));
  return { fecha, satelites, lat, lng, velocidad, rumbo, valido: (estado & 0x02) !== 0, ...(extras ? { extras } : {}) };
}

const texto = (b: Buffer) => b.toString('latin1').replace(/\0+$/g, '').trim();

/**
 * Información adicional de la posición: lista de [id (1) largo (1) valor].
 * Los ids 0x01–0x31 son de la norma; 0x80–0x8E y 0xCC son del fabricante
 * del SEG-9888G (ver ExtrasVehiculo). 0x9F (celda) y los vacíos se omiten.
 */
export function leerExtras(b: Buffer): { satelites: number; extras: ExtrasVehiculo | null } {
  let satelites = 0;
  const extras: ExtrasVehiculo = { crudos: {} };
  let hay = false;
  let i = 0;
  while (i + 2 <= b.length) {
    const id = b[i];
    const largo = b[i + 1];
    const v = b.subarray(i + 2, i + 2 + largo);
    i += 2 + largo;
    if (v.length !== largo) break; // TLV cortado
    hay = true;
    if (v.length === 0) continue;
    const n = v.readUIntBE(0, Math.min(v.length, 6));
    switch (id) {
      case 0x01: extras.odometroEquipoKm = n / 10; break;
      case 0x03: extras.velocidadObd = n / 10; break;
      case 0x30: extras.senal = n; break;
      case 0x31: satelites = n; break;
      case 0x80: extras.cargaMotor = n; break;
      case 0x81: extras.rpm = n; break;
      case 0x82: if (n > 0) extras.voltaje = n / 10; break;
      case 0x83: extras.velocidadObd = n; break;
      // Temperaturas: el equipo pasa el byte OBD tal cual, sin restarle los 40
      // de la norma (PID 05/0F: °C = A − 40). Con los 40 restados la curva del
      // auto de Ariel fue 40 → 80 °C en 11 minutos de ciudad y el aire de
      // admisión 17–18 °C (mañana de octubre en Santiago); sin restarlos
      // habría sido 80 → 120 °C, un recalentamiento, y aire a 57 °C.
      case 0x84: extras.temperaturaMotor = n - 40; break;
      case 0x86: extras.temperaturaAdmision = n - 40; break;
      case 0x8b: if (texto(v)) extras.vin = texto(v); break;
      case 0x8c: extras.kmObd = n / 10; break;
      case 0x8e: extras.combustiblePct = n; break;
      case 0xcc: if (texto(v)) extras.iccid = texto(v); break;
      case 0x9f: break;
      default: extras.crudos[id.toString(16).padStart(2, '0')] = v.toString('hex');
    }
  }
  return { satelites, extras: hay ? extras : null };
}

export function interpretarJt808(trama: TramaJt808, ahora = new Date()): MensajeJt808 {
  const { msgId, cuerpo } = trama;
  if (msgId === MSG.REGISTRO) {
    // 2013: provincia(2) ciudad(2) fabricante(5) modelo(20) terminal(7) color(1) placa.
    const registro: Registro = {
      fabricante: texto(cuerpo.subarray(4, 9)),
      modelo: texto(cuerpo.subarray(9, 29)),
      terminalId: texto(cuerpo.subarray(29, 36)),
      placa: texto(cuerpo.subarray(37)),
    };
    return { tipo: 'registro', registro, trama };
  }
  if (msgId === MSG.AUTENTICACION) return { tipo: 'autenticacion', codigo: texto(cuerpo), trama };
  if (msgId === MSG.LATIDO) return { tipo: 'latido', trama };
  if (msgId === MSG.POSICION || msgId === MSG.POSICION_EVENTO) return { tipo: 'posicion', posicion: decodificarPosicionJt808(cuerpo, ahora), trama };
  if (msgId === MSG.POSICIONES) {
    // cantidad(2) tipo(1) y luego [largo(2) cuerpo de 0x0200] repetido.
    const posiciones: PosicionGt06[] = [];
    let i = 3;
    while (i + 2 <= cuerpo.length) {
      const largo = cuerpo.readUInt16BE(i);
      const p = decodificarPosicionJt808(cuerpo.subarray(i + 2, i + 2 + largo), ahora);
      if (p) posiciones.push(p);
      i += 2 + largo;
    }
    return { tipo: 'posiciones', posiciones, trama };
  }
  return { tipo: 'otro', trama };
}

/** Arma una trama completa (escapada, con suma) hacia el terminal. */
export function construirTrama(msgId: number, telefonoBcd: Buffer, serie: number, cuerpo: Buffer): Buffer {
  const cabecera = Buffer.alloc(12);
  cabecera.writeUInt16BE(msgId, 0);
  cabecera.writeUInt16BE(cuerpo.length & 0x03ff, 2);
  telefonoBcd.copy(cabecera, 4, 0, 6);
  cabecera.writeUInt16BE(serie & 0xffff, 10);
  const sinSuma = Buffer.concat([cabecera, cuerpo]);
  const conSuma = Buffer.concat([sinSuma, Buffer.from([xor(sinSuma)])]);
  return Buffer.concat([Buffer.from([0x7e]), escapar(conSuma), Buffer.from([0x7e])]);
}

/** 0x8100: serie del registro (2), resultado (1: 0 = ok) y código de autenticación. */
export function respuestaRegistro(t: TramaJt808, serieServidor: number, codigo = 'SEVEN'): Buffer {
  const cuerpo = Buffer.concat([Buffer.from([(t.serie >> 8) & 0xff, t.serie & 0xff, 0]), Buffer.from(codigo, 'latin1')]);
  return construirTrama(MSG.RESPUESTA_REGISTRO, t.telefonoBcd, serieServidor, cuerpo);
}

/** 0x8001: serie (2) e id (2) del mensaje contestado, resultado (1: 0 = ok). */
export function respuestaGeneral(t: TramaJt808, serieServidor: number, resultado = 0): Buffer {
  const cuerpo = Buffer.from([(t.serie >> 8) & 0xff, t.serie & 0xff, (t.msgId >> 8) & 0xff, t.msgId & 0xff, resultado]);
  return construirTrama(MSG.RESPUESTA_GENERAL, t.telefonoBcd, serieServidor, cuerpo);
}

export function respuestaParaJt808(m: MensajeJt808, serieServidor: number): Buffer {
  return m.tipo === 'registro' ? respuestaRegistro(m.trama, serieServidor) : respuestaGeneral(m.trama, serieServidor);
}
