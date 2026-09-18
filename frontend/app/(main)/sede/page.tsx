"use client";

import { useEffect, useState } from "react";
import VenuesMaster from "@/app/(main)/masters/venues/page";
import SedeResumen from "@/components/SedeResumen";
import { getStoredUser } from "@/lib/api";

/**
 * /sede: operaciones ve el maestro de Sedes (editar); un usuario acotado a una
 * delegación (Jefe de Misión) ve el resumen de sólo lectura con coordinadores.
 */
export default function SedePage() {
  const [scoped, setScoped] = useState<boolean | null>(null);

  useEffect(() => {
    const meta = getStoredUser()?.user_metadata ?? {};
    setScoped(typeof meta.delegationId === "string" && meta.delegationId.length > 0);
  }, []);

  if (scoped === null) return null;
  return scoped ? <SedeResumen /> : <VenuesMaster />;
}
