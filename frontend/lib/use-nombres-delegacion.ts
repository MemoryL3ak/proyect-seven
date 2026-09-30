"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { nombresDelegacion, type DelegationLike, type NombresDelegacion } from "@/lib/delegations";
import { useEventoActivo } from "@/lib/evento-activo-provider";

type DelegacionConEvento = DelegationLike & { eventId?: string | null };

// Una sola petición por carga del panel: las delegaciones casi no cambian y
// varias pantallas piden el nombre a la vez.
let enCurso: Promise<DelegacionConEvento[]> | null = null;
const cargar = () =>
  (enCurso ??= apiFetch<DelegacionConEvento[]>("/delegations").then(
    (l) => (Array.isArray(l) ? l : []),
    () => {
      enCurso = null;
      return [];
    },
  ));

/**
 * "Región" o "País" (y sus variantes) para el evento activo del panel, o
 * para `eventId` si se pasa. Ver nombresDelegacion.
 */
export function useNombresDelegacion(eventId?: string | null): NombresDelegacion {
  const { eventoId } = useEventoActivo();
  const id = eventId ?? eventoId;
  const [todas, setTodas] = useState<DelegacionConEvento[]>([]);
  useEffect(() => {
    let vivo = true;
    void cargar().then((l) => vivo && setTodas(l));
    return () => {
      vivo = false;
    };
  }, []);
  return useMemo(() => nombresDelegacion(todas.filter((d) => !id || d.eventId === id)), [todas, id]);
}
