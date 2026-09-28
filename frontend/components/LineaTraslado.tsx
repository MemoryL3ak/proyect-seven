"use client";

/**
 * Línea de tiempo de un traslado de aeropuerto (monitores de llegadas y
 * salidas). Los pasos se marcan solos cuando el conductor toca Iniciar,
 * Recoger o Finalizar en su app; ver lib/linea-traslado.
 */
import { BRAND, STATE, SURFACE } from "@/lib/design";
import { horaEvento } from "@/lib/hora-evento";
import { useI18n } from "@/lib/i18n";
import { lineaDeTraslado, pasoSiguiente, type ViajeConBitacora } from "@/lib/linea-traslado";
import { trasladoRealizado } from "@/lib/marcar-traslado";

/**
 * "Marcar realizado" en un traslado sin terminar; "Marcar pendiente" en uno
 * terminado (por si se marcó por error).
 */
export function BotonMarcar({
  realizado,
  marcando,
  onClick,
}: {
  realizado: boolean;
  marcando?: boolean;
  onClick: () => void;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      disabled={marcando}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        marginLeft: "auto",
        flexShrink: 0,
        fontSize: 10,
        fontWeight: 700,
        padding: "3px 10px",
        borderRadius: 99,
        cursor: marcando ? "wait" : "pointer",
        opacity: marcando ? 0.6 : 1,
        border: `1px solid ${realizado ? SURFACE.border : BRAND.teal}`,
        background: realizado ? SURFACE.card : BRAND.teal,
        color: realizado ? SURFACE.textMuted : "#fff",
        whiteSpace: "nowrap",
      }}
    >
      {marcando ? t("Guardando…") : realizado ? t("Marcar pendiente") : t("Marcar realizado")}
    </button>
  );
}

export default function LineaTraslado({
  viaje,
  conductor,
  ahora,
  onMarcar,
  marcando = false,
}: {
  viaje: ViajeConBitacora;
  /** Nombre del conductor asignado; null = sin conductor. */
  conductor?: string | null;
  ahora?: Date;
  /**
   * Botón Realizado / Pendiente: cambia el estado del viaje, el mismo que ve
   * el conductor en su app. Sin esta función no se muestra.
   */
  onMarcar?: () => void;
  marcando?: boolean;
}) {
  const { t } = useI18n();
  const cancelado = String(viaje.status ?? "").toUpperCase() === "CANCELLED";
  const pasos = lineaDeTraslado(viaje, ahora ?? new Date());
  const siguiente = cancelado ? null : pasoSiguiente(pasos);

  return (
    <div style={{ minWidth: 300 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 11 }}>
        {cancelado ? (
          <span style={{ fontWeight: 700, color: STATE.dangerText }}>{t("Traslado cancelado")}</span>
        ) : conductor ? (
          <span style={{ color: SURFACE.textSecondary }}>
            <span style={{ fontWeight: 700, color: SURFACE.textMuted }}>{t("Conductor")}: </span>
            {conductor}
          </span>
        ) : (
          <span style={{ fontWeight: 700, color: STATE.warningText, background: STATE.warningSoft, border: `1px solid ${STATE.warningBorder}`, borderRadius: 99, padding: "1px 8px" }}>
            {t("Sin conductor")}
          </span>
        )}
        {onMarcar && !cancelado && (
          <BotonMarcar realizado={trasladoRealizado(viaje)} marcando={marcando} onClick={onMarcar} />
        )}
      </div>
      <ol style={{ display: "flex", alignItems: "flex-start", listStyle: "none", margin: 0, padding: 0, opacity: cancelado ? 0.45 : 1 }}>
        {pasos.map((paso, i) => {
          const esSiguiente = paso.clave === siguiente;
          const color = paso.hecho ? BRAND.teal : esSiguiente ? STATE.warning : SURFACE.borderStrong;
          const hora = paso.hora ? horaEvento(paso.hora) : paso.prevista ? horaEvento(paso.prevista) : null;
          return (
            <li key={paso.clave} style={{ flex: 1, minWidth: 0, position: "relative", textAlign: "center" }}>
              {/* Tramo hacia el paso anterior */}
              {i > 0 && (
                <span aria-hidden style={{
                  position: "absolute", top: 6, right: "50%", width: "100%", height: 2,
                  background: paso.hecho ? BRAND.teal : SURFACE.borderMuted,
                }} />
              )}
              <span aria-hidden style={{
                position: "relative", display: "inline-block", width: 14, height: 14, borderRadius: "50%",
                background: paso.hecho ? BRAND.teal : SURFACE.card,
                border: `2px solid ${color}`,
                boxShadow: esSiguiente ? `0 0 0 4px ${STATE.warningSoft}` : "none",
                animation: esSiguiente ? "pulse 2s ease-in-out infinite" : undefined,
              }} />
              <span style={{ display: "block", marginTop: 4, fontSize: 10, fontWeight: paso.hecho || esSiguiente ? 700 : 500, color: paso.hecho ? SURFACE.text : esSiguiente ? STATE.warningText : SURFACE.textMuted, lineHeight: 1.2 }}>
                {t(paso.etiqueta)}
              </span>
              {hora && (
                <span style={{ display: "block", fontSize: 10, color: paso.hecho ? SURFACE.textSecondary : SURFACE.textFaint, fontStyle: paso.hecho ? "normal" : "italic" }}>
                  {paso.hecho ? hora : `${t("prev.")} ${hora}`}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
