"use client";

/**
 * Pestaña Vuelos de la app del Coordinador de Sede (28-09-2026, World Rugby
 * U20): llegadas y salidas del evento, por vuelo, con el traslado de cada
 * pasajero (pendiente, en curso o realizado) y su conductor. De consulta.
 */
import { useEffect, useMemo, useState } from "react";
import { SegmentedFilter } from "@/components/ui/FilterControls";
import { PlaneIcon, RefreshIcon } from "@/components/ui/Icons";
import { apiFetch } from "@/lib/api";
import { BRAND, STATE, SURFACE } from "@/lib/design";
import { fechaCortaEvento, horaEvento } from "@/lib/hora-evento";
import { useI18n } from "@/lib/i18n";
import { nombrePropio } from "@/lib/nombres";
import { agruparVuelos, type EstadoTraslado, type PasajeroVuelo, soloProximos } from "@/lib/vuelos-evento";

const REFRESCO_MS = 60_000;

const TRASLADO: Record<EstadoTraslado, { label: string; color: string; bg: string }> = {
  SIN_TRASLADO: { label: "Sin traslado", color: SURFACE.textMuted, bg: SURFACE.bg },
  PENDIENTE: { label: "Pendiente", color: STATE.warningText, bg: STATE.warningSoft },
  EN_CURSO: { label: "En curso", color: STATE.infoText, bg: STATE.infoSoft },
  REALIZADO: { label: "Realizado", color: STATE.successText, bg: STATE.successSoft },
};

export default function VuelosEvento({ eventId }: { eventId?: string | null }) {
  const { t } = useI18n();
  const [filas, setFilas] = useState<PasajeroVuelo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sentido, setSentido] = useState<"LLEGADA" | "SALIDA">("LLEGADA");
  const [alcance, setAlcance] = useState<"proximos" | "todos">("proximos");
  const [ahora, setAhora] = useState(() => new Date());

  const cargar = async () => {
    try {
      const q = eventId ? `?eventId=${encodeURIComponent(eventId)}` : "";
      setFilas(await apiFetch<PasajeroVuelo[]>(`/flights/evento${q}`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("No se pudieron cargar los vuelos."));
    } finally {
      setCargando(false);
      setAhora(new Date());
    }
  };

  useEffect(() => {
    void cargar();
    const timer = setInterval(() => void cargar(), REFRESCO_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const grupos = useMemo(() => {
    const todos = agruparVuelos(filas, sentido, ahora);
    return alcance === "proximos" ? soloProximos(todos, ahora) : todos;
  }, [filas, sentido, alcance, ahora]);

  const etiquetaEstado = (estado: string) =>
    sentido === "SALIDA"
      ? estado === "ARRIBADO" ? t("Despegó") : estado === "HOY" ? t("Hoy") : t("Programado")
      : estado === "ARRIBADO" ? t("Arribado") : estado === "HOY" ? t("Hoy") : t("Programado");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <SegmentedFilter
          value={sentido}
          onChange={(v) => setSentido(v as "LLEGADA" | "SALIDA")}
          options={[{ value: "LLEGADA", label: t("Llegadas") }, { value: "SALIDA", label: t("Salidas") }]}
        />
        <SegmentedFilter
          value={alcance}
          onChange={(v) => setAlcance(v as "proximos" | "todos")}
          options={[{ value: "proximos", label: t("Hoy y próximos") }, { value: "todos", label: t("Todos") }]}
        />
        <button type="button" onClick={() => void cargar()} aria-label={t("Actualizar")} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: SURFACE.textMuted, padding: 6 }}>
          <RefreshIcon size={16} strokeWidth={2} />
        </button>
      </div>

      {cargando && <p style={{ fontSize: 13, color: SURFACE.textFaint, textAlign: "center", padding: 20 }}>{t("Cargando vuelos…")}</p>}
      {error && <p role="alert" style={{ fontSize: 13, color: STATE.dangerText, textAlign: "center", padding: 12 }}>{error}</p>}
      {!cargando && !error && grupos.length === 0 && (
        <p style={{ fontSize: 13, color: SURFACE.textFaint, textAlign: "center", padding: 20 }}>
          {sentido === "LLEGADA" ? t("No hay llegadas para mostrar.") : t("No hay salidas para mostrar.")}
        </p>
      )}

      {grupos.map((g) => (
        <div key={g.clave} style={{ background: SURFACE.card, borderRadius: 14, border: `1px solid ${SURFACE.border}`, padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <PlaneIcon size={18} color={BRAND.teal} strokeWidth={1.8} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: SURFACE.text, margin: 0 }}>
                {g.aerolinea ? `${g.aerolinea} · ` : ""}{g.vuelo}
              </p>
              <p style={{ fontSize: 11, color: SURFACE.textMuted, margin: "2px 0 0" }}>
                {sentido === "LLEGADA"
                  ? (g.origen ? `${t("Desde")} ${g.origen}` : t("Origen no informado"))
                  : g.recogida ? `${t("Recogida en el hotel")}: ${fechaCortaEvento(g.recogida)} ${horaEvento(g.recogida)}` : t("Sin recogida programada")}
              </p>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: BRAND.tealInk, margin: 0 }}>{horaEvento(g.hora)}</p>
              <p style={{ fontSize: 11, color: SURFACE.textFaint, margin: 0 }}>{fechaCortaEvento(g.hora)}</p>
              <span style={{ display: "inline-block", marginTop: 3, fontSize: 10, fontWeight: 700, padding: "1px 8px", borderRadius: 99, background: SURFACE.bg, color: SURFACE.textMuted, border: `1px solid ${SURFACE.border}` }}>
                {etiquetaEstado(g.estado)}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10, paddingTop: 8, borderTop: `1px dashed ${SURFACE.border}` }}>
            {g.pasajeros.map((p) => {
              const tono = TRASLADO[p.traslado];
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <span style={{ flex: 1, minWidth: 0, fontWeight: 600, color: SURFACE.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {nombrePropio(p.nombre)}
                    {p.pais && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: SURFACE.textMuted }}>{p.pais}</span>}
                    {p.conductor && <span style={{ display: "block", fontSize: 11, fontWeight: 400, color: SURFACE.textMuted }}>{t("Conductor")}: {nombrePropio(p.conductor)}</span>}
                  </span>
                  <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: tono.bg, color: tono.color }}>
                    {t(tono.label)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
