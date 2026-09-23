/**
 * Filtros del listado "Registros y validación" de Inscripción de
 * participantes. La lógica vive acá, fuera de ResourceScreen, para poder
 * probarla sin montar el componente.
 */

export type EstadoValidacion = "all" | "validated" | "pending";

export type FiltrosParticipantes = {
  /** Texto del buscador; compara contra el nombre completo. */
  busqueda: string;
  estado: EstadoValidacion;
  /** Id de la delegación (región). Vacío = todas. */
  delegationId: string;
  /** Id de la disciplina. Vacío = todas. */
  disciplineId: string;
  /** Tipo de participante (TA, TF, JEFE_MISION, ...). Vacío = todos. */
  userType: string;
};

export const FILTROS_PARTICIPANTES_VACIOS: FiltrosParticipantes = {
  busqueda: "",
  estado: "all",
  delegationId: "",
  disciplineId: "",
  userType: "",
};

export type ParticipanteFiltrable = {
  fullName?: string | null;
  delegationId?: string | null;
  disciplineId?: string | null;
  disciplineIds?: unknown;
  userType?: string | null;
};

/**
 * Disciplinas a las que pertenece el participante. Un Jefe de Misión cubre
 * varias (disciplineIds); un deportista trae una sola (disciplineId). Se
 * unen las dos para que el filtro por disciplina encuentre a ambos.
 */
export function disciplinasDelParticipante(p: ParticipanteFiltrable): string[] {
  const ids = Array.isArray(p.disciplineIds)
    ? p.disciplineIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  if (p.disciplineId && !ids.includes(p.disciplineId)) ids.push(p.disciplineId);
  return ids;
}

export function filtrarParticipantes<T extends ParticipanteFiltrable>(
  items: T[],
  filtros: FiltrosParticipantes,
  esValidado: (item: T) => boolean,
): T[] {
  const texto = filtros.busqueda.trim().toLowerCase();
  return items.filter((item) => {
    if (texto && !(item.fullName ?? "").toLowerCase().includes(texto)) return false;
    if (filtros.estado !== "all") {
      const validado = esValidado(item);
      if (filtros.estado === "validated" && !validado) return false;
      if (filtros.estado === "pending" && validado) return false;
    }
    if (filtros.delegationId && (item.delegationId ?? "") !== filtros.delegationId) return false;
    if (filtros.disciplineId && !disciplinasDelParticipante(item).includes(filtros.disciplineId)) return false;
    if (filtros.userType && (item.userType ?? "") !== filtros.userType) return false;
    return true;
  });
}

/**
 * Cuántos filtros (desplegables) están puestos. El buscador no cuenta: se
 * limpia solo desde su propio campo.
 */
export function contarFiltrosParticipantesActivos(filtros: FiltrosParticipantes): number {
  let n = 0;
  if (filtros.estado !== "all") n += 1;
  if (filtros.delegationId) n += 1;
  if (filtros.disciplineId) n += 1;
  if (filtros.userType) n += 1;
  return n;
}

/**
 * Cuenta cuántos participantes quedarían por cada valor de `clave` con los
 * demás filtros puestos. Sirve para mostrar "(n)" en cada opción del
 * desplegable, igual que en Viajes: el número refleja lo que se vería al
 * elegir esa opción, no el total de la base.
 */
export function contarPorOpcion<T extends ParticipanteFiltrable>(
  items: T[],
  filtros: FiltrosParticipantes,
  clave: "estado" | "delegationId" | "disciplineId" | "userType",
  esValidado: (item: T) => boolean,
): { base: T[]; porValor: Map<string, number> } {
  const sinEsteFiltro: FiltrosParticipantes = { ...filtros, [clave]: clave === "estado" ? "all" : "" };
  const base = filtrarParticipantes(items, sinEsteFiltro, esValidado);
  const porValor = new Map<string, number>();
  const sumar = (valor: string) => porValor.set(valor, (porValor.get(valor) ?? 0) + 1);
  for (const item of base) {
    if (clave === "estado") sumar(esValidado(item) ? "validated" : "pending");
    else if (clave === "disciplineId") disciplinasDelParticipante(item).forEach(sumar);
    else sumar(item[clave] ?? "");
  }
  return { base, porValor };
}
