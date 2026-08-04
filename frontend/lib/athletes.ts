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
