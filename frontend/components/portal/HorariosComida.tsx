"use client";

import { useEffect, useMemo, useState } from "react";
import { ClockIcon } from "@/components/ui/Icons";
import { apiFetch } from "@/lib/api";
import { BRAND, SURFACE } from "@/lib/design";
import { useI18n } from "@/lib/i18n";

/**
 * Hasta qué hora se puede ir a comer.
 *
 * El portal decía qué se come pero no cuándo, que es la pregunta que llega al
 * comedor cuando ya está cerrando. Cada comida tiene un bloque general y
 * algunos días una extensión excepcional que lo reemplaza —el 24-09 el
 * desayuno abre 06:30, el 22-09 la cena cierra 23:45—, así que lo que se
 * muestra es el horario *de hoy*, no el de la planilla general.
 */
type Bloque = {
  id: string;
  mealType: string;
  /** null = bloque general de todos los días. */
  date: string | null;
  startsAt: string;
  endsAt: string;
  note?: string | null;
};

const ROTULO: Record<string, string> = {
  DESAYUNO: "Desayuno",
  ALMUERZO: "Almuerzo",
  COLACION: "Colación",
  CENA: "Cena",
};

const ORDEN = ["DESAYUNO", "ALMUERZO", "COLACION", "CENA"];

/** Hoy en hora local: en UTC, después de las 21:00 en Chile ya es mañana. */
function hoyLocal() {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

export default function HorariosComida({ eventId }: { eventId?: string | null }) {
  const { t } = useI18n();
  const [bloques, setBloques] = useState<Bloque[] | null>(null);

  useEffect(() => {
    let vivo = true;
    const url = eventId ? `/meal-time-blocks?eventId=${encodeURIComponent(eventId)}` : "/meal-time-blocks";
    void apiFetch<Bloque[]>(url)
      .then((filas) => { if (vivo) setBloques(Array.isArray(filas) ? filas : []); })
      .catch(() => { if (vivo) setBloques([]); });
    return () => { vivo = false; };
  }, [eventId]);

  const deHoy = useMemo(() => {
    const hoy = hoyLocal();
    // La extensión del día manda sobre el general; si no hay, vale el general.
    return ORDEN.map((comida) => {
      const delDia = (bloques ?? []).find((b) => b.mealType === comida && b.date === hoy);
      const general = (bloques ?? []).find((b) => b.mealType === comida && !b.date);
      const vigente = delDia ?? general;
      return vigente ? { comida, bloque: vigente, extendido: Boolean(delDia) } : null;
    }).filter(Boolean) as { comida: string; bloque: Bloque; extendido: boolean }[];
  }, [bloques]);

  // Mientras no se sabe, no se pinta; sin bloques cargados, tampoco: una caja
  // vacía de horarios se lee como que hoy no se sirve comida.
  if (bloques === null || deHoy.length === 0) return null;

  return (
    <div style={{ background: SURFACE.card, borderRadius: 14, border: `1px solid ${SURFACE.border}`, overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", borderBottom: `1px solid ${SURFACE.borderMuted}`, display: "flex", alignItems: "center", gap: 8 }}>
        <ClockIcon size={14} color={BRAND.teal} strokeWidth={2} />
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: BRAND.teal, margin: 0 }}>
          {t("Horarios de hoy")}
        </p>
      </div>
      <div style={{ padding: "6px 14px 12px" }}>
        {deHoy.map(({ comida, bloque, extendido }) => (
          <div key={comida} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0" }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: SURFACE.text }}>
              {t(ROTULO[comida] ?? comida)}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: SURFACE.text, fontVariantNumeric: "tabular-nums" }}>
              {bloque.startsAt} – {bloque.endsAt}
            </span>
            {/* Se dice cuándo el horario no es el de siempre: si no, quien ya
                se sabe el general de memoria no mira el renglón. */}
            {extendido && (
              <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "rgba(33,208,179,0.12)", color: BRAND.tealInk, whiteSpace: "nowrap" }}>
                {t("hoy extendido")}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
