"use client";

import { useEffect, useState } from "react";
import { getStoredUser } from "@/lib/api";
import { permisosDesdeMetadata, veCobros } from "@/lib/permisos-panel";

/** ¿El usuario del panel ve el valor de los viajes? (ver veCobros). */
export function usuarioVeCobros(): boolean {
  return veCobros(permisosDesdeMetadata(getStoredUser()?.user_metadata));
}

/**
 * Lo mismo para pintar: parte en false y se resuelve al montar, así el
 * servidor (que no conoce al usuario) y el navegador pintan lo mismo y el
 * valor nunca aparece un instante a quien no le corresponde.
 */
export function useVeCobros(): boolean {
  const [ve, setVe] = useState(false);
  useEffect(() => setVe(usuarioVeCobros()), []);
  return ve;
}
