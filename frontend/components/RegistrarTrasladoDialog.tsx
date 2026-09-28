"use client";

/**
 * Registrar a mano un traslado realizado (monitores de llegadas y salidas):
 * conductor, hora de inicio y de término. Ver lib/registro-traslado.
 */
import { useEffect, useMemo, useState } from "react";
import StyledSelect from "@/components/StyledSelect";
import { BRAND, STATE, SURFACE } from "@/lib/design";
import { useI18n } from "@/lib/i18n";
import { useIsMobile } from "@/lib/useIsMobile";
import { errorDeRegistro, horasPorDefecto, type ViajeRegistrable } from "@/lib/registro-traslado";

export type DatosRegistro = { driverId: string; inicio: string; termino: string };

export default function RegistrarTrasladoDialog({
  open,
  titulo,
  detalle,
  viaje,
  conductores,
  guardando = false,
  onGuardar,
  onCancel,
}: {
  open: boolean;
  titulo: string;
  /** Quién y qué vuelo, para saber qué se está registrando. */
  detalle: string;
  /** El primer traslado: de él salen el conductor y las horas propuestas. */
  viaje: ViajeRegistrable | null;
  conductores: Array<{ value: string; label: string }>;
  guardando?: boolean;
  onGuardar: (datos: DatosRegistro) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const [driverId, setDriverId] = useState("");
  const [inicio, setInicio] = useState("");
  const [termino, setTermino] = useState("");
  const [intentado, setIntentado] = useState(false);

  // Cada vez que se abre, parte de lo que tiene el viaje.
  useEffect(() => {
    if (!open || !viaje) return;
    const horas = horasPorDefecto(viaje, new Date());
    setDriverId(viaje.driverId ?? "");
    setInicio(horas.inicio);
    setTermino(horas.termino);
    setIntentado(false);
  }, [open, viaje]);

  const error = useMemo(() => {
    if (!driverId) return t("Elige el conductor que hizo el traslado.");
    const e = errorDeRegistro(inicio, termino, new Date());
    return e ? t(e) : null;
  }, [driverId, inicio, termino, t]);

  // El conductor asignado puede no estar en la lista del evento: se agrega.
  const opciones = useMemo(() => {
    if (!driverId || conductores.some((c) => c.value === driverId)) return conductores;
    return [{ value: driverId, label: t("Conductor asignado") }, ...conductores];
  }, [conductores, driverId, t]);

  if (!open) return null;

  const etiqueta = { fontSize: "11px", fontWeight: 700, color: SURFACE.textMuted, margin: "0 0 6px", letterSpacing: "0.04em" } as const;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rt-title"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center",
        padding: isMobile ? 0 : "16px", background: "rgba(2,12,24,0.72)", backdropFilter: "blur(6px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !guardando) onCancel(); }}
    >
      <div style={{
        background: SURFACE.card, borderRadius: isMobile ? "20px 20px 0 0" : "20px",
        boxShadow: "0 24px 64px rgba(0,0,0,0.28)", width: "100%", maxWidth: isMobile ? "none" : "440px",
        padding: isMobile ? "24px 20px calc(20px + env(safe-area-inset-bottom))" : "28px 28px 22px",
        position: "relative", overflow: "visible",
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", borderRadius: "20px 20px 0 0", background: `linear-gradient(90deg,${BRAND.teal},${BRAND.tealLight},${BRAND.teal})` }} />
        <h2 id="rt-title" style={{ fontSize: "17px", fontWeight: 700, color: SURFACE.text, margin: "0 0 6px" }}>{titulo}</h2>
        <p style={{ fontSize: "13px", color: SURFACE.textMuted, margin: "0 0 18px", lineHeight: 1.5 }}>
          {detalle} {t("Queda en la bitácora del viaje que se registró a mano, y el conductor lo ve cerrado en su app.")}
        </p>

        <div style={{ display: "grid", gap: "14px" }}>
          <div>
            <p style={etiqueta}>{t("Conductor")}</p>
            <StyledSelect value={driverId} onChange={(e) => setDriverId(e.target.value)}>
              <option value="">{t("Elegir conductor")}</option>
              {opciones.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </StyledSelect>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "12px" }}>
            <label style={{ display: "block" }}>
              <p style={etiqueta}>{t("Inicio")}</p>
              <input className="input" type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} style={{ borderRadius: "10px", width: "100%" }} />
            </label>
            <label style={{ display: "block" }}>
              <p style={etiqueta}>{t("Término")}</p>
              <input className="input" type="datetime-local" value={termino} onChange={(e) => setTermino(e.target.value)} style={{ borderRadius: "10px", width: "100%" }} />
            </label>
          </div>
          {intentado && error && (
            <p role="alert" style={{ fontSize: "12px", fontWeight: 600, color: STATE.dangerText, margin: 0 }}>{error}</p>
          )}
        </div>

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "22px", flexDirection: isMobile ? "column-reverse" : "row" }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={guardando}
            style={{ padding: "10px 20px", borderRadius: "12px", border: `1px solid ${SURFACE.border}`, background: SURFACE.bg, color: SURFACE.textSecondary, fontSize: "14px", fontWeight: 600, cursor: "pointer", minHeight: isMobile ? "48px" : undefined }}
          >
            {t("Cancelar")}
          </button>
          <button
            type="button"
            disabled={guardando}
            onClick={() => {
              setIntentado(true);
              if (!error) onGuardar({ driverId, inicio, termino });
            }}
            style={{ padding: "10px 22px", borderRadius: "12px", border: "none", background: `linear-gradient(135deg,${BRAND.teal},#14AE98)`, color: "#fff", fontSize: "14px", fontWeight: 700, cursor: guardando ? "wait" : "pointer", opacity: guardando ? 0.7 : 1, minHeight: isMobile ? "48px" : undefined }}
          >
            {guardando ? t("Guardando…") : t("Registrar realizado")}
          </button>
        </div>
      </div>
    </div>
  );
}
