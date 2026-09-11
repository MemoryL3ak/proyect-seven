"use client";

import { useI18n } from "@/lib/i18n";
import { tripStatusMeta, requestStatusMeta } from "@/lib/design";

type StatusPillProps = {
  status?: string | null;
  /** "trip" (default) usa el catálogo de viajes; "request" el de solicitudes. */
  kind?: "trip" | "request";
  size?: "sm" | "md";
};

/**
 * Pastilla de estado con el catálogo canónico de lib/design.
 * Reemplaza los STATUS_CFG locales que cada página redefinía.
 */
export default function StatusPill({ status, kind = "trip", size = "md" }: StatusPillProps) {
  const { t } = useI18n();
  const meta = kind === "request" ? requestStatusMeta(status) : tripStatusMeta(status);
  const sm = size === "sm";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: sm ? "2px 8px" : "3px 10px",
        borderRadius: 20,
        fontSize: sm ? 10 : 11,
        fontWeight: 700,
        background: meta.bg,
        color: meta.color,
        whiteSpace: "nowrap",
      }}
    >
      {t(meta.label)}
    </span>
  );
}
