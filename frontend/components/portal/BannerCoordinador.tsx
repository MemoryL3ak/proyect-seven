"use client";

import { useEffect, useState } from "react";
import { MessageIcon } from "@/components/ui/Icons";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { BRAND, SURFACE } from "@/lib/design";
import { openExternal, whatsappHref } from "@/lib/external-link";

type Coordinator = { name: string; phone: string };

/**
 * Banner de contacto con el Coordinador General, arriba de Actividades para el
 * Jefe de Delegación. Ocupa el lugar que tenía el banner de "bus en ruta": el
 * estado de los buses ya lo cuenta "Ahora mismo" justo debajo, así que arriba
 * va lo que el jefe no tenía a mano.
 *
 * El contacto es por WhatsApp, igual que la tarjeta de Sedes y por la misma
 * decisión de producto que hay en el backend (findGeneralCoordinator): no se
 * llama al conductor, se le escribe al coordinador. A diferencia de esa
 * tarjeta, aquí el banner dice a quién se le va a escribir —nombre y teléfono—
 * y lleva el mensaje ya redactado con la delegación de quien escribe, que es
 * el dato que el coordinador necesita en el primer renglón.
 *
 * Sin coordinador con teléfono cargado el botón no puede abrir WhatsApp; en
 * ese caso cae en la sala de asistencia (onSinWhatsapp) en vez de quedar
 * muerto, y el subtítulo lo dice.
 */
export default function BannerCoordinador({
  delegacion,
  nombreJefe,
  onSinWhatsapp,
}: {
  /** Región del jefe, para el mensaje ya escrito. */
  delegacion?: string | null;
  nombreJefe?: string | null;
  /** Qué hacer si no hay coordinador con teléfono. */
  onSinWhatsapp?: () => void;
}) {
  const { t } = useI18n();
  const [coordinador, setCoordinador] = useState<Coordinator | null>(null);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<Coordinator | Record<string, never>>("/m/auth/coordinator");
        setCoordinador(data && "phone" in data && data.phone ? (data as Coordinator) : null);
      } catch {
        setCoordinador(null);
      } finally {
        setCargado(true);
      }
    })();
  }, []);

  // Mientras no se sabe, no se pinta: un banner que cambia de texto al segundo
  // de abrir la pantalla se lee como un error.
  if (!cargado) return null;

  const saludo = [
    `Hola${coordinador?.name ? ` ${coordinador.name.split(" ")[0]}` : ""},`,
    nombreJefe ? `soy ${nombreJefe}` : "te escribo",
    delegacion ? `de la delegación ${delegacion}.` : "desde el portal.",
  ].join(" ");

  const alPulsar = () => {
    if (coordinador) {
      openExternal(whatsappHref(coordinador.phone, saludo));
      return;
    }
    onSinWhatsapp?.();
  };

  return (
    <button
      type="button"
      onClick={alPulsar}
      style={{
        position: "relative", overflow: "hidden", width: "100%", textAlign: "left", cursor: "pointer",
        display: "flex", flexDirection: "column", gap: 12,
        borderRadius: 16, padding: "15px 16px",
        background: `linear-gradient(135deg,${BRAND.tealInk} 0%,${BRAND.tealDark} 52%,${BRAND.tealInk} 100%)`,
        border: "1px solid rgba(52,243,198,0.45)",
        boxShadow: "0 6px 24px rgba(10,122,107,0.35)",
      }}
    >
      {/* Resplandor de esquina */}
      <span style={{ position: "absolute", top: 0, right: 0, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(ellipse,rgba(52,243,198,0.22) 0%,transparent 65%)", transform: "translate(55px,-70px)", pointerEvents: "none" }} />
      {/* Hairline inferior con barrido, como el resto de banners del portal */}
      <span style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 2, pointerEvents: "none",
        background: `linear-gradient(90deg,transparent,${BRAND.tealLight} 40%,${SURFACE.card} 50%,${BRAND.tealLight} 60%,transparent)`,
        backgroundSize: "200% 100%", animation: "shimmerLine 3.5s linear infinite",
      }} />

      <span style={{ display: "flex", alignItems: "center", gap: 13, position: "relative" }}>
        <span style={{
          position: "relative", flexShrink: 0, width: 44, height: 44, borderRadius: 14,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.25)",
        }}>
          <MessageIcon size={21} color={SURFACE.card} strokeWidth={1.9} />
          <span style={{ position: "absolute", top: 4, right: 4, width: 8, height: 8, borderRadius: "50%", background: BRAND.tealLight, boxShadow: `0 0 8px ${BRAND.tealLight}`, animation: "pulseDot 1.8s ease-in-out infinite" }} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.85)" }}>
            {t("Coordinador General")}
          </span>
          <span style={{ display: "block", fontSize: 15, fontWeight: 800, color: SURFACE.card, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {coordinador?.name || t("Contacto de coordinación")}
          </span>
          <span style={{ display: "block", fontSize: 11.5, color: "rgba(255,255,255,0.78)", margin: "3px 0 0" }}>
            {coordinador
              ? coordinador.phone
              : t("Aún sin teléfono cargado: se abre la sala de asistencia.")}
          </span>
        </span>
      </span>

      <span style={{
        position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: "11px 16px", borderRadius: 11,
        fontSize: 12.5, fontWeight: 800, letterSpacing: "0.02em",
        background: SURFACE.card, color: BRAND.tealInk,
        boxShadow: "0 3px 12px rgba(0,0,0,0.18)",
      }}>
        <MessageIcon size={15} strokeWidth={2.2} />
        {coordinador ? t("Escribir por WhatsApp") : t("Generar contacto")}
      </span>
    </button>
  );
}
