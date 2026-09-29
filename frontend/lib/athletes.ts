export function isAthletePersonalDataValidated(item: unknown): boolean {
  const athlete = (item ?? {}) as {
    status?: string | null;
    metadata?: Record<string, unknown> | null;
  };

  // Una cuenta eliminada nunca cuenta como validada, aunque su metadata
  // conserve personalDataValidated de antes de la baja.
  if (athlete.status === "DELETED") return false;

  return (
    athlete.status === "PERSONAL_DATA_VALIDATED" ||
    athlete.metadata?.personalDataValidated === true
  );
}

export function filterValidatedAthletes<T>(items: T[] | null | undefined): T[] {
  return (items ?? []).filter((item) => isAthletePersonalDataValidated(item));
}

/**
 * Pasajeros de los monitores de vuelos (28-09-2026): toda ficha no eliminada,
 * validada o no. Las fichas que carga AND quedan REGISTERED hasta que el
 * participante valida sus datos, y los monitores de Llegadas, Salidas y la
 * pestaña Vuelos de la app las ocultaban: los coordinadores de BVAN veían un
 * solo vuelo de 14 en World Rugby. Un pasajero con vuelo se recoge igual.
 */
export function filterPasajerosDeVuelos<T>(items: T[] | null | undefined): T[] {
  return (items ?? []).filter((item) => (item as { status?: string | null })?.status !== "DELETED");
}
