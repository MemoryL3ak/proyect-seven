import PortalSkeleton from "@/components/PortalSkeleton";

/**
 * Estado de carga a nivel de ruta para todos los portales: al navegar entre
 * secciones Next muestra la silueta del portal en lugar de una pantalla vacía.
 */
export default function Loading() {
  return <PortalSkeleton />;
}
