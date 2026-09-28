/**
 * Registrar a mano un traslado realizado, desde los monitores de llegadas y
 * salidas (28-09-2026, pedido de Ariel). Marcelo llevó a Fernando Ginzo el
 * 27-09 (vuelo H2 1811) sin marcarlo en la app: "Marcar realizado" al día
 * siguiente dejaba inicio y término con la hora del clic, y el control de
 * jornada le contaba ese traslado hoy. Ahora se anotan el conductor y las
 * horas reales, y queda en la bitácora que fue un registro manual.
 */
import { horaEvento, fechaCortaEvento } from "@/lib/hora-evento";

export type ViajeRegistrable = {
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  driverId?: string | null;
};

/** Duración supuesta cuando no se sabe a qué hora terminó. */
export const DURACION_SUPUESTA_MIN = 60;

const dos = (n: number) => String(n).padStart(2, "0");

/** ISO → valor de un campo datetime-local (hora del navegador). */
export function aCampoFechaHora(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

/**
 * Horas que trae el formulario: las que ya marcó el conductor; si no, la hora
 * del traslado y, de término, "ahora" si el traslado fue hace poco o la
 * duración supuesta si fue otro día.
 */
export function horasPorDefecto(viaje: ViajeRegistrable, ahora: Date): { inicio: string; termino: string } {
  const inicioIso = viaje.startedAt ?? viaje.scheduledAt ?? ahora.toISOString();
  const inicio = new Date(inicioIso);
  let termino: Date;
  if (viaje.completedAt) termino = new Date(viaje.completedAt);
  else {
    const transcurrido = ahora.getTime() - inicio.getTime();
    termino =
      transcurrido > 0 && transcurrido <= 3 * 3_600_000
        ? ahora
        : new Date(inicio.getTime() + DURACION_SUPUESTA_MIN * 60_000);
  }
  return { inicio: aCampoFechaHora(inicio), termino: aCampoFechaHora(termino) };
}

/** Motivo por el que no se puede guardar, o null si está bien. */
export function errorDeRegistro(inicio: string, termino: string, ahora: Date): string | null {
  const a = new Date(inicio);
  const b = new Date(termino);
  if (!inicio || Number.isNaN(a.getTime())) return "Indica la hora de inicio.";
  if (!termino || Number.isNaN(b.getTime())) return "Indica la hora de término.";
  if (b.getTime() < a.getTime()) return "El término no puede ser antes del inicio.";
  if (b.getTime() > ahora.getTime() + 5 * 60_000) return "El término no puede quedar en el futuro.";
  return null;
}

/** Cuerpo del PATCH /trips/:id que deja el traslado realizado. */
export function cuerpoRegistro(datos: { inicio: string; termino: string; driverId?: string | null; donde: string }, ahora: Date) {
  const startedAt = new Date(datos.inicio).toISOString();
  const completedAt = new Date(datos.termino).toISOString();
  return {
    status: "COMPLETED",
    startedAt,
    completedAt,
    ...(datos.driverId ? { driverId: datos.driverId } : {}),
    metadata: {
      log: [
        {
          action: "REGISTRO_MANUAL",
          by: datos.donde,
          at: ahora.toISOString(),
          detail: `Realizado: ${fechaCortaEvento(startedAt)} ${horaEvento(startedAt)} → ${horaEvento(completedAt)}`,
        },
      ],
    },
  };
}
