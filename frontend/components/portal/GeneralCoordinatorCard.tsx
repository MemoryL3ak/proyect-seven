"use client";

import { useEffect, useState } from "react";
import { PhoneIcon, WhatsappIcon } from "@/components/ui/Icons";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { BRAND, SURFACE } from "@/lib/design";
import { openExternal, whatsappHref } from "@/lib/external-link";

type Coordinator = { name: string; phone: string };

/**
 * Tarjeta del Coordinador General para el Jefe de Misión (portal): nombre y
 * teléfono con acceso directo a WhatsApp. El backend entrega el teléfono sólo
 * a sesiones autenticadas (GET /m/auth/coordinator).
 */
export default function GeneralCoordinatorCard() {
  const { t } = useI18n();
  const [coordinator, setCoordinator] = useState<Coordinator | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<Coordinator | Record<string, never>>("/m/auth/coordinator");
        setCoordinator(data && "phone" in data && data.phone ? (data as Coordinator) : null);
      } catch {
        setCoordinator(null);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  if (!loaded) return null;

  return (
    <div
      style={{
        background: SURFACE.card,
        borderRadius: 14,
        border: `1px solid ${SURFACE.border}`,
        borderLeft: `4px solid ${BRAND.teal}`,
        padding: 14,
      }}
    >
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: BRAND.teal, margin: "0 0 6px" }}>
        {t("Coordinador General")}
      </p>
      {coordinator ? (
        <>
          <p style={{ fontSize: 14, fontWeight: 700, color: SURFACE.text, margin: 0 }}>{coordinator.name}</p>
          <p style={{ fontSize: 12, color: SURFACE.textMuted, margin: "3px 0 10px", display: "flex", alignItems: "center", gap: 6 }}>
            <PhoneIcon size={12} /> {coordinator.phone}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            onClick={() => openExternal(whatsappHref(coordinator.phone))}
          >
            <WhatsappIcon size={16} /> {t("WhatsApp al Coordinador General")}
          </button>
        </>
      ) : (
        <p style={{ fontSize: 12.5, color: SURFACE.textMuted, margin: 0 }}>
          {t("Aún no hay un Coordinador General con teléfono registrado.")}
        </p>
      )}
    </div>
  );
}
