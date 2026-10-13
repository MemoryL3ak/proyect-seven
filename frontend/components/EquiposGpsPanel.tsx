"use client";

/**
 * "GPS de vehículos" en Monitoreo de conductores. Misma tabla que "Detalle de
 * conductores" de esta pantalla (13-10-2026, Ariel: la versión anterior "no
 * pega mucho con nuestro estilo"): barra de título, encabezado con degradado
 * gris, filas alternadas con realce verde, avatar redondo con degradado y
 * pastillas como las de Estado/Ocupación/GPS. El selector de patente se ve
 * como los desplegables del panel y su lista se dibuja sobre la página (la
 * tabla con scroll la recortaba).
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ACCENT, BRAND, STATE, SURFACE } from "@/lib/design";
import { useI18n } from "@/lib/i18n";
import { direccionDeLista } from "@/lib/desplegable";
import {
  estadoDeEquipo,
  hace,
  lineaEstadoVehiculo,
  modeloEquipo,
  nombreEquipo,
  opcionesPatente,
  ordenarEquipos,
  situacionEquipo,
  type EquipoGps,
  type Situacion,
} from "@/lib/gps-vehiculos";
import { CarIcon, ChevronDownIcon, MapPinnedIcon, SearchIcon } from "@/components/ui/Icons";

/** Pastilla de situación, con la forma de "Conectado" en la tabla de conductores. */
const PASTILLA: Record<Situacion["tono"], { texto: string; bg: string; fg: string; borde: string; punto: string; pulso: boolean }> = {
  movimiento: { texto: "En movimiento", bg: `linear-gradient(135deg,${STATE.successSoft},${STATE.successBorder})`, fg: STATE.successText, borde: "#86efac", punto: STATE.success, pulso: true },
  motor: { texto: "Motor encendido", bg: `linear-gradient(135deg,${STATE.warningSoft},${STATE.warningBorder})`, fg: STATE.warningText, borde: STATE.warningBorder, punto: STATE.warning, pulso: false },
  detenido: { texto: "Detenido", bg: `linear-gradient(135deg,${STATE.infoSoft},${STATE.infoBorder})`, fg: STATE.infoText, borde: STATE.infoBorder, punto: STATE.info, pulso: false },
  sinConexion: { texto: "Sin conexión", bg: SURFACE.borderMuted, fg: SURFACE.textMuted, borde: "#cbd5e1", punto: SURFACE.textFaint, pulso: false },
};

type Props = {
  equipos: EquipoGps[];
  patentes: string[];
  ahora: number;
  onAsignar: (imei: string, plate: string | null) => Promise<void>;
  onVerEnMapa: (imei: string) => void;
  focoImei: string | null;
};

const COLUMNAS = ["Vehículo", "Estado", "Velocidad", "Conductor", "Datos del vehículo", "Última conexión", "GPS", "Patente", ""];

export default function EquiposGpsPanel({ equipos, patentes, ahora, onAsignar, onVerEnMapa, focoImei }: Props) {
  const { t } = useI18n();
  const orden = ordenarEquipos(equipos, ahora);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, boxShadow: "0 1px 4px rgba(15,23,42,0.04)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2 p-4" style={{ borderBottom: `1px solid ${SURFACE.borderMuted}` }}>
        <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: SURFACE.textSecondary }}>
          {t("GPS de vehículos")}
        </h2>
        <span style={{ fontSize: 11.5, color: SURFACE.textFaint, fontWeight: 500 }}>
          {equipos.length} {equipos.length === 1 ? t("equipo") : t("equipos")}
        </span>
      </div>
      {equipos.length === 0 ? (
        <p className="p-6 text-sm" style={{ color: SURFACE.textMuted, margin: 0 }}>
          {t("Ningún equipo GPS se ha conectado todavía. Al apuntarlo al servidor (SMS SERVER) aparece acá con su IMEI, y se le asigna un vehículo.")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" style={{ fontSize: 12.5, borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr>
                {COLUMNAS.map((h, i) => (
                  <th
                    key={h || `col-${i}`}
                    className="p-3 text-left"
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: SURFACE.textMuted,
                      whiteSpace: "nowrap",
                      background: `linear-gradient(135deg,${SURFACE.bg} 0%,${SURFACE.borderMuted} 100%)`,
                      boxShadow: `inset 0 -2px 0 ${SURFACE.border}`,
                    }}
                  >
                    {h ? t(h) : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orden.map((e, i) => (
                <FilaEquipo
                  key={e.imei}
                  equipo={e}
                  par={i % 2 === 0}
                  ultima={i === orden.length - 1}
                  patentes={patentes}
                  ahora={ahora}
                  enFoco={focoImei === e.imei}
                  onAsignar={onAsignar}
                  onVerEnMapa={onVerEnMapa}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilaEquipo({
  equipo: e,
  par,
  ultima,
  patentes,
  ahora,
  enFoco,
  onAsignar,
  onVerEnMapa,
}: {
  equipo: EquipoGps;
  par: boolean;
  ultima: boolean;
  patentes: string[];
  ahora: number;
  enFoco: boolean;
  onAsignar: (imei: string, plate: string | null) => Promise<void>;
  onVerEnMapa: (imei: string) => void;
}) {
  const { t } = useI18n();
  const situacion = situacionEquipo(e, ahora);
  const pastilla = PASTILLA[situacion.tono];
  const estado = estadoDeEquipo(e, ahora);
  const p = e.ultimaPosicion;
  const apagado = situacion.tono === "sinConexion";
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const elegir = (plate: string | null) => {
    setGuardando(true);
    setError(null);
    onAsignar(e.imei, plate)
      .catch((err) => setError(err instanceof Error ? err.message : t("No se pudo asignar la patente")))
      .finally(() => setGuardando(false));
  };
  const linea = lineaEstadoVehiculo(e);
  const modelo = modeloEquipo(e);
  // Conectado pero sin posición reciente: no es "Detenido", es falta de señal GPS.
  const textoEstado = situacion.texto === "Conectado, sin señal GPS" ? "Sin señal GPS" : pastilla.texto;
  const fondo = enFoco ? "rgba(33,208,179,0.10)" : par ? SURFACE.card : SURFACE.bg;
  const vacio = <span style={{ color: SURFACE.borderStrong, fontSize: 11 }}>—</span>;
  return (
    <tr
      style={{ borderBottom: ultima ? "none" : `1px solid ${SURFACE.borderMuted}`, background: fondo, transition: "background 0.15s" }}
      onMouseEnter={(ev) => { ev.currentTarget.style.background = STATE.successSoft; }}
      onMouseLeave={(ev) => { ev.currentTarget.style.background = fondo; }}
    >
      {/* Vehículo (avatar + patente), como el conductor en la otra tabla. Pinchar lo muestra en el mapa. */}
      <td className="p-3" style={{ whiteSpace: "nowrap" }}>
        <button
          type="button"
          onClick={() => p && onVerEnMapa(e.imei)}
          disabled={!p}
          title={p ? t("Ver en el mapa") : undefined}
          style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: 0, padding: 0, textAlign: "left", cursor: p ? "pointer" : "default" }}
        >
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: estado.conectado
                ? `linear-gradient(135deg, ${BRAND.teal} 0%, #15B09A 100%)`
                : `linear-gradient(135deg, ${SURFACE.borderStrong} 0%, ${SURFACE.textFaint} 100%)`,
              boxShadow: estado.conectado ? "0 2px 8px rgba(33,208,179,0.35)" : "0 1px 3px rgba(15,23,42,0.1)",
            }}
          >
            <CarIcon size={16} color={SURFACE.card} strokeWidth={2.3} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: SURFACE.text, lineHeight: 1.2 }}>{nombreEquipo(e)}</span>
            <span style={{ display: "block", fontSize: 10.5, color: SURFACE.textFaint, marginTop: 2 }}>{modelo}</span>
          </span>
        </button>
      </td>

      {/* Estado */}
      <td className="p-3" style={{ whiteSpace: "nowrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, padding: "4px 10px", borderRadius: 99, fontWeight: 700, letterSpacing: "0.02em", background: pastilla.bg, color: pastilla.fg, border: `1px solid ${pastilla.borde}` }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: pastilla.punto, animation: pastilla.pulso ? "pulse 1.8s infinite" : "none" }} />
          {t(textoEstado)}
        </span>
      </td>

      {/* Velocidad */}
      <td className="p-3" style={{ whiteSpace: "nowrap", opacity: apagado ? 0.55 : 1 }}>
        {p ? (
          <span style={{ fontWeight: 700, color: p.velocidad >= 3 ? SURFACE.text : SURFACE.textMuted }}>
            {Math.round(p.velocidad)} <span style={{ fontWeight: 500, fontSize: 11, color: SURFACE.textFaint }}>km/h</span>
          </span>
        ) : (
          vacio
        )}
      </td>

      {/* Conductor (+ "En viaje" con la pastilla violeta de Ocupación) */}
      <td className="p-3" style={{ whiteSpace: "nowrap" }}>
        {e.conductorNombre ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 600, color: SURFACE.textStrong }}>{e.conductorNombre}</span>
            {e.tripId && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, padding: "3px 9px", borderRadius: 99, fontWeight: 700, background: `linear-gradient(135deg,${ACCENT.violetSoft},#ddd6fe)`, color: "#5b21b6", border: "1px solid #c4b5fd" }}>
                <CarIcon size={11} strokeWidth={2.5} />
                {t("En viaje")}
              </span>
            )}
          </div>
        ) : (
          vacio
        )}
      </td>

      {/* Datos del vehículo */}
      <td className="p-3" style={{ color: SURFACE.textSecondary, fontSize: 11.5, minWidth: 160, maxWidth: 260, opacity: apagado ? 0.55 : 1 }}>
        {linea || vacio}
      </td>

      {/* Última conexión */}
      <td className="p-3" style={{ color: SURFACE.textSecondary, whiteSpace: "nowrap", fontSize: 11.5 }}>
        {hace(estado.edadPaqueteS)}
      </td>

      {/* GPS, como en la tabla de conductores */}
      <td className="p-3" style={{ whiteSpace: "nowrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, padding: "3px 8px", borderRadius: 6, fontWeight: 700, background: estado.gpsVivo ? STATE.successSoft : SURFACE.borderMuted, color: estado.gpsVivo ? STATE.successText : SURFACE.textFaint, border: `1px solid ${estado.gpsVivo ? "#86efac" : "#cbd5e1"}` }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: estado.gpsVivo ? STATE.success : SURFACE.borderStrong, boxShadow: estado.gpsVivo ? `0 0 6px ${STATE.success}` : "none" }} />
          {estado.gpsVivo ? `${t("Reportando")}${p && p.satelites > 0 ? ` · ${p.satelites} sat.` : ""}` : t("Sin señal")}
        </span>
      </td>

      {/* Patente */}
      <td className="p-3" style={{ whiteSpace: "nowrap" }}>
        <SelectorPatente actual={e.vehiclePlate} conocidas={patentes} guardando={guardando} onElegir={elegir} />
        {(error || e.ultimoError) && <div style={{ fontSize: 10.5, color: STATE.dangerText, fontWeight: 700, marginTop: 4, whiteSpace: "normal", maxWidth: 200 }}>{error ?? e.ultimoError}</div>}
      </td>

      {/* Ver en el mapa */}
      <td className="p-3" style={{ textAlign: "right" }}>
        <button
          type="button"
          onClick={() => onVerEnMapa(e.imei)}
          disabled={!p}
          title={t("Ver en el mapa")}
          aria-label={t("Ver en el mapa")}
          style={{ width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: `1px solid ${enFoco ? BRAND.teal : SURFACE.border}`, background: enFoco ? "rgba(33,208,179,0.12)" : SURFACE.card, cursor: p ? "pointer" : "not-allowed", opacity: p ? 1 : 0.4 }}
        >
          <MapPinnedIcon size={15} color={BRAND.tealDark} strokeWidth={2.3} />
        </button>
      </td>
    </tr>
  );
}

/**
 * Selector de patente con el aspecto de los desplegables del panel
 * (StyledSelect): buscador arriba, patentes conocidas del evento, "usar como
 * patente nueva" si lo escrito no existe y quitar. La lista va en un portal
 * con posición fija para que no la recorte el scroll de la tabla.
 */
export function SelectorPatente({
  actual,
  conocidas,
  guardando,
  onElegir,
}: {
  actual: string | null;
  conocidas: string[];
  guardando: boolean;
  onElegir: (plate: string | null) => void;
}) {
  const { t } = useI18n();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [activo, setActivo] = useState(0);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; arriba: boolean } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const { lista, nueva } = opcionesPatente(conocidas, actual, texto);
  type Item = { valor: string | null; texto: string; tipo: "nueva" | "patente" | "quitar" };
  const items: Item[] = [
    ...(nueva ? [{ valor: nueva, texto: `${t("Usar")} ${nueva} ${t("como patente nueva")}`, tipo: "nueva" as const }] : []),
    ...lista.map((p) => ({ valor: p, texto: p, tipo: "patente" as const })),
    ...(actual && !texto.trim() ? [{ valor: null, texto: t("Quitar patente"), tipo: "quitar" as const }] : []),
  ];

  const ubicar = () => {
    if (!ref.current || typeof window === "undefined") return;
    const r = ref.current.getBoundingClientRect();
    const width = Math.max(r.width, 210);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    const arriba = direccionDeLista(window.innerHeight - r.bottom, r.top, 320) === "arriba";
    setPos(arriba ? { left, width, bottom: window.innerHeight - r.top, arriba } : { left, width, top: r.bottom, arriba });
  };

  useLayoutEffect(() => {
    if (abierto) ubicar();
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (ev: MouseEvent) => {
      const n = ev.target as Node;
      if (ref.current?.contains(n) || popRef.current?.contains(n)) return;
      setAbierto(false);
    };
    // Si la página o la tabla se desplazan, la lista se cierra (su propio scroll no cuenta).
    const desplazamiento = (ev: Event) => {
      if (popRef.current && ev.target instanceof Node && popRef.current.contains(ev.target)) return;
      setAbierto(false);
    };
    const cerrar = () => setAbierto(false);
    document.addEventListener("mousedown", fuera);
    window.addEventListener("scroll", desplazamiento, true);
    window.addEventListener("resize", cerrar);
    return () => {
      document.removeEventListener("mousedown", fuera);
      window.removeEventListener("scroll", desplazamiento, true);
      window.removeEventListener("resize", cerrar);
    };
  }, [abierto]);

  const abrir = () => {
    if (guardando) return;
    setTexto("");
    setActivo(0);
    setAbierto((v) => !v);
  };
  const elegir = (p: string | null) => {
    setAbierto(false);
    if (p !== actual) onElegir(p);
  };

  const arriba = abierto && pos?.arriba;
  const lista_ = abierto && pos && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={popRef}
          role="listbox"
          style={{
            position: "fixed",
            left: pos.left,
            width: pos.width,
            ...(pos.top != null ? { top: pos.top } : { bottom: pos.bottom }),
            zIndex: 10000,
            background: SURFACE.card,
            border: `1px solid ${BRAND.teal}`,
            ...(arriba ? { borderBottom: "none", borderRadius: "10px 10px 0 0", boxShadow: "0 -8px 24px rgba(15,23,42,0.12)" } : { borderTop: "none", borderRadius: "0 0 10px 10px", boxShadow: "0 8px 24px rgba(15,23,42,0.12)" }),
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "6px 8px", borderBottom: `1px solid ${SURFACE.borderMuted}`, position: "relative" }}>
            <SearchIcon size={13} color={SURFACE.textFaint} strokeWidth={2.4} style={{ position: "absolute", left: 17, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input
              autoFocus
              type="text"
              value={texto}
              placeholder={t("Buscar patente…")}
              aria-label={t("Buscar patente…")}
              onChange={(ev) => { setTexto(ev.target.value); setActivo(0); }}
              onKeyDown={(ev) => {
                if (ev.key === "ArrowDown") { ev.preventDefault(); setActivo((i) => Math.min(items.length - 1, i + 1)); }
                else if (ev.key === "ArrowUp") { ev.preventDefault(); setActivo((i) => Math.max(0, i - 1)); }
                else if (ev.key === "Enter") { ev.preventDefault(); const it = items[activo]; if (it) elegir(it.valor); }
                else if (ev.key === "Escape") { ev.preventDefault(); setAbierto(false); }
              }}
              style={{ width: "100%", boxSizing: "border-box", padding: "6px 10px 6px 27px", fontSize: 13, lineHeight: 1.5, borderRadius: 8, border: `1px solid ${SURFACE.border}`, background: SURFACE.bg, color: SURFACE.text, outline: "none" }}
            />
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {items.length === 0 && <div style={{ padding: "8px 12px", fontSize: 12.5, color: SURFACE.textFaint }}>{t("Sin resultados")}</div>}
            {items.map((it, i) => (
              <div
                key={`${it.tipo}-${it.valor ?? "quitar"}`}
                role="option"
                aria-selected={i === activo}
                onMouseEnter={() => setActivo(i)}
                onMouseDown={(ev) => { ev.preventDefault(); elegir(it.valor); }}
                style={{
                  padding: "7px 12px",
                  fontSize: 13,
                  cursor: "pointer",
                  color: it.tipo === "quitar" ? STATE.dangerText : it.tipo === "nueva" ? BRAND.tealInk : SURFACE.text,
                  fontWeight: it.tipo === "patente" ? 400 : 600,
                  background: i === activo ? SURFACE.bg : "transparent",
                  borderBottom: i < items.length - 1 ? `1px solid ${SURFACE.borderMuted}` : "none",
                }}
              >
                {it.texto}
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div ref={ref} style={{ position: "relative", width: 150 }}>
      <div
        role="combobox"
        aria-expanded={abierto}
        aria-haspopup="listbox"
        tabIndex={guardando ? -1 : 0}
        onMouseDown={(ev) => { ev.preventDefault(); abrir(); }}
        onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); abrir(); } }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          borderRadius: abierto ? (arriba ? "0 0 10px 10px" : "10px 10px 0 0") : "10px",
          border: `1px solid ${abierto ? BRAND.teal : SURFACE.border}`,
          background: SURFACE.bg,
          fontSize: 12.5,
          lineHeight: 1.5,
          color: actual ? SURFACE.text : SURFACE.textFaint,
          fontWeight: actual ? 700 : 400,
          letterSpacing: actual ? "0.04em" : 0,
          cursor: guardando ? "wait" : "pointer",
          opacity: guardando ? 0.6 : 1,
          boxShadow: abierto ? "0 0 0 3px rgba(33,208,179,0.12)" : "none",
          userSelect: "none",
          transition: "border-color 150ms ease, box-shadow 150ms ease",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{guardando ? t("Guardando…") : actual ?? t("Sin patente")}</span>
        <ChevronDownIcon size={14} color={abierto ? BRAND.teal : SURFACE.textFaint} strokeWidth={2.5} style={{ flexShrink: 0, marginLeft: 8, transition: "transform 150ms ease", transform: abierto ? "rotate(180deg)" : "rotate(0deg)" }} />
      </div>
      {lista_}
    </div>
  );
}
