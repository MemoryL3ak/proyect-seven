/**
 * Horas y fechas en la hora del evento, no en la del aparato.
 *
 * Viajes, calendario y posiciones se guardan como instantes (UTC) y se
 * mostraban con la hora local del teléfono. Chile pasó al horario de verano el
 * 6 de septiembre; un celular con la zona horaria fija, o con la hora
 * automática apagada, muestra todo corrido una hora: el mismo traslado salía a
 * las 15:00 en el panel y a las 14:00 en la app del Coordinador de Transporte.
 * Aquí todo se formatea en America/Santiago, que es donde ocurre el evento,
 * cualquiera sea la zona del aparato.
 */
export const ZONA_EVENTO = "America/Santiago";

const formato = (opciones: Intl.DateTimeFormatOptions, idioma = "es-CL") => {
  try {
    return new Intl.DateTimeFormat(idioma, { timeZone: ZONA_EVENTO, ...opciones });
  } catch {
    // Motor sin datos de zonas horarias: mejor la hora local que romper.
    return new Intl.DateTimeFormat(idioma, opciones);
  }
};

// hourCycle "h23" y no hour12:false: con hour12:false Chrome escribe "24:05"
// a la medianoche.
const HORA = formato({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const HORA_SEGUNDOS = formato({ hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const FECHA_CORTA = formato({ day: "2-digit", month: "short" });
const DIA_LARGO = formato({ weekday: "short", day: "2-digit", month: "short" });
const FECHA_HORA = formato({ day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const FECHA_HORA_ANIO = formato({
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
// en-CA escribe YYYY-MM-DD: ordena bien y sirve de clave.
const CLAVE_DIA = formato({ year: "numeric", month: "2-digit", day: "2-digit" }, "en-CA");

const fecha = (valor?: string | Date | null): Date | null => {
  if (valor == null || valor === "" || valor === "null" || valor === "undefined") return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "14:30". */
export const horaEvento = (valor?: string | Date | null, vacio = "--:--") => {
  const d = fecha(valor);
  return d ? HORA.format(d) : vacio;
};

/** "14:30:05". */
export const horaSegundosEvento = (valor?: string | Date | null, vacio = "--:--:--") => {
  const d = fecha(valor);
  return d ? HORA_SEGUNDOS.format(d) : vacio;
};

/** "24 sept". */
export const fechaCortaEvento = (valor?: string | Date | null, vacio = "—") => {
  const d = fecha(valor);
  return d ? FECHA_CORTA.format(d).replace(/\./g, "") : vacio;
};

/** "mié 24 sept". */
export const diaLargoEvento = (valor?: string | Date | null, vacio = "") => {
  const d = fecha(valor);
  return d ? DIA_LARGO.format(d).replace(/\./g, "") : vacio;
};

/** "24-09, 14:30". */
export const fechaHoraEvento = (valor?: string | Date | null, vacio = "—") => {
  const d = fecha(valor);
  return d ? FECHA_HORA.format(d) : vacio;
};

/** "24-09-2026, 14:30", o null si no hay fecha válida. */
export const fechaHoraAnioEvento = (valor?: string | Date | null): string | null => {
  const d = fecha(valor);
  return d ? FECHA_HORA_ANIO.format(d) : null;
};

/**
 * Día de un instante en el evento, "YYYY-MM-DD". Un traslado de las 23:00 es
 * de ese día aunque en UTC ya sea el siguiente. Vacío = sin fecha.
 */
export const claveDiaEvento = (valor?: string | Date | null) => {
  const d = fecha(valor);
  return d ? CLAVE_DIA.format(d) : "";
};

/** "Hoy", o "mié 24 sept". Sólo se distingue hoy: el resto se lee por fecha. */
export const etiquetaDiaEvento = (clave: string) => {
  if (clave === claveDiaEvento(new Date())) return "Hoy";
  // Mediodía UTC cae dentro del mismo día en Santiago.
  return diaLargoEvento(new Date(`${clave}T12:00:00Z`));
};
