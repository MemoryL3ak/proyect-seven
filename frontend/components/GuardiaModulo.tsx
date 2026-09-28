"use client";

/**
 * Guardia de las páginas del panel según los módulos del usuario
 * (lib/permisos-panel). Hasta el 28-09-2026 los módulos sólo ocultaban ítems
 * del menú: escribiendo la dirección se entraba igual a cualquier página.
 * Ahora una página sin módulo muestra "Sin acceso", y una de sólo lectura
 * avisa arriba que los cambios están bloqueados (el servidor los rechaza).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getStoredUser } from "@/lib/api";
import { BRAND, STATE, SURFACE } from "@/lib/design";
import { useI18n } from "@/lib/i18n";
import { nivelEnRuta, permisosDesdeMetadata, type PermisosPanel } from "@/lib/permisos-panel";

export default function GuardiaModulo({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const ruta = usePathname() || "/";
  const [permisos, setPermisos] = useState<PermisosPanel | null>(null);

  useEffect(() => {
    setPermisos(permisosDesdeMetadata(getStoredUser()?.user_metadata));
  }, []);

  // Hasta leer al usuario no se muestra nada: evita ver un instante una
  // página a la que no tiene acceso.
  if (!permisos) return null;
  const nivel = nivelEnRuta(permisos, ruta);

  if (nivel === "ninguno") {
    return (
      <div style={{ maxWidth: 520, margin: "48px auto", padding: "28px", borderRadius: 18, background: SURFACE.card, border: `1px solid ${SURFACE.border}`, textAlign: "center" }}>
        <p style={{ fontSize: 17, fontWeight: 700, color: SURFACE.text, margin: "0 0 8px" }}>{t("Sin acceso a este módulo")}</p>
        <p style={{ fontSize: 13, color: SURFACE.textMuted, margin: "0 0 18px", lineHeight: 1.5 }}>
          {t("Tu usuario no tiene habilitada esta sección. Si la necesitas, pídesela al administrador.")}
        </p>
        <Link href="/cuenta" style={{ fontSize: 13, fontWeight: 700, color: BRAND.tealInk }}>{t("Ver mis módulos")}</Link>
      </div>
    );
  }

  return (
    <>
      {nivel === "ver" && (
        <div role="note" style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 12px", padding: "8px 14px", borderRadius: 12, background: STATE.infoSoft, border: `1px solid ${STATE.infoBorder}`, color: STATE.infoText, fontSize: 12, fontWeight: 600 }}>
          {t("Solo lectura: puedes revisar este módulo, pero tu usuario no puede hacer cambios.")}
        </div>
      )}
      {children}
    </>
  );
}
