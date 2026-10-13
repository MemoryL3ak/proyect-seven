"use client";

/**
 * "GPS de vehículos" en Monitoreo de conductores. 13-10-2026: Ariel pidió
 * primero algo más cuidado que la tabla básica ("muy fea, el listbox se ve
 * pésimo"); probamos tarjetas y las rechazó por poco prácticas ("debe ser
 * tabla"). Queda una tabla compacta: una fila por equipo con la situación en
 * color, velocidad, conductor, lo que informa el auto, la patente con un
 * selector propio (su lista se dibuja sobre la página y no la recorta el
 * scroll de la tabla) y el botón para verlo en el mapa.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BRAND, STATE, SURFACE } from "@/lib/design";
import { useI18n } from "@/lib/i18n";
import { direccionDeLista } from "@/lib/desplegable";
import {
  estadoDeEquipo,
  hace,
  lineaEstadoVehiculo,
  nombreEquipo,
  opcionesPatente,
  ordenarEquipos,
  resumenEquipos,
  situacionEquipo,
  type EquipoGps,
  type Situacion,
} from "@/lib/gps-vehiculos";
import { CarIcon, ChevronDownIcon, MapPinnedIcon, PlusIcon, SearchIcon, XIcon } from "@/components/ui/Icons";

/** Colores por situación sobre fondo claro (la ficha del mapa usa los mismos tonos sobre oscuro). */
export const TONO_FILA: Record<Situacion["tono"], { punto: string; bg: string; fg: string; borde: string }> = {
  movimiento: { punto: STATE.success, bg: STATE.successSoft, fg: STATE.successText, borde: STATE.successBorder },
  motor: { punto: STATE.warning, bg: STATE.warningSoft, fg: STATE.warningText, borde: STATE.warningBorder },
  detenido: { punto: STATE.info, bg: STATE.infoSoft, fg: STATE.infoText, borde: STATE.infoBorder },
  sinConexion: { punto: SURFACE.textFaint, bg: SURFACE.borderMuted, fg: SURFACE.textMuted, borde: SURFACE.border },
};

/** Resumen del encabezado, en singular y plural. */
const ETIQUETA_RESUMEN: Record<Situacion["tono"], [string, string]> = {
  movimiento: ["en movimiento", "en movimiento"],
  motor: ["detenido con motor encendido", "detenidos con motor encendido"],
  detenido: ["detenido", "detenidos"],
  sinConexion: ["sin conexión", "sin conexión"],
};

const PASTILLA: Record<Situacion["tono"], string> = {
  movimiento: "En movimiento",
  motor: "Motor encendido",
  detenido: "Detenido",
  sinConexion: "Sin conexión",
};

type Props = {
  equipos: EquipoGps[];
  patentes: string[];
  ahora: number;
  onAsignar: (imei: string, plate: string | null) => Promise<void>;
  onVerEnMapa: (imei: string) => void;
  focoImei: string | null;
};

export default function EquiposGpsPanel({ equipos, patentes, ahora, onAsignar, onVerEnMapa, focoImei }: Props) {
  const { t } = useI18n();
  const resumen = resumenEquipos(equipos, ahora);
  const orden = ordenarEquipos(equipos, ahora);
  const th = (texto: string, extra?: React.CSSProperties) => (
    <th
      style={{
        textAlign: "left",
        padding: "10px 14px",
        fontSize: 10.5,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: SURFACE.textMuted,
        background: SURFACE.bg,
        borderBottom: `1px solid ${SURFACE.border}`,
        whiteSpace: "nowrap",
        ...extra,
      }}
    >
      {texto}
    </th>
  );
  return (
    <section style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: 16, boxShadow: "0 1px 4px rgba(15,23,42,0.04)", overflow: "hidden" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 10, padding: "16px 18px 14px" }}>
        <div style={{ minWidth: 0 }}>
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: SURFACE.textSecondary, margin: 0 }}>
            {t("GPS de vehículos")}
          </h2>
          {equipos.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 7, fontSize: 12, color: SURFACE.textSecondary }}>
              {(Object.keys(ETIQUETA_RESUMEN) as Situacion["tono"][])
                .filter((k) => resumen[k] > 0)
                .map((k) => (
                  <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: TONO_FILA[k].punto }} />
                    <strong style={{ color: SURFACE.text }}>{resumen[k]}</strong> {t(ETIQUETA_RESUMEN[k][resumen[k] === 1 ? 0 : 1])}
                  </span>
                ))}
              {resumen.sinPatente > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: STATE.warningText, whiteSpace: "nowrap" }}>
                  <strong>{resumen.sinPatente}</strong> {t("sin patente asignada")}
                </span>
              )}
            </div>
          )}
        </div>
        <span style={{ fontSize: 12, color: SURFACE.textFaint, fontWeight: 600 }}>
          {equipos.length} {equipos.length === 1 ? t("equipo") : t("equipos")}
        </span>
      </div>
      {equipos.length === 0 ? (
        <p className="p-6 text-sm" style={{ color: SURFACE.textMuted, margin: 0, borderTop: `1px solid ${SURFACE.borderMuted}` }}>
          {t("Ningún equipo GPS se ha conectado todavía. Al apuntarlo al servidor (SMS SERVER) aparece acá con su IMEI, y se le asigna un vehículo.")}
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="tabla-gps" style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13 }}>
            <thead>
              <tr>
                {th(t("Vehículo"), { paddingLeft: 18 })}
                {th(t("Situación"))}
                {th(t("Velocidad"))}
                {th(t("Conductor"))}
                {th(t("Estado del vehículo"))}
                {th(t("Patente"))}
                {th("", { width: 56 })}
              </tr>
            </thead>
            <tbody>
              {orden.map((e) => (
                <FilaEquipo key={e.imei} equipo={e} patentes={patentes} ahora={ahora} enFoco={focoImei === e.imei} onAsignar={onAsignar} onVerEnMapa={onVerEnMapa} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FilaEquipo({
  equipo: e,
  patentes,
  ahora,
  enFoco,
  onAsignar,
  onVerEnMapa,
}: {
  equipo: EquipoGps;
  patentes: string[];
  ahora: number;
  enFoco: boolean;
  onAsignar: (imei: string, plate: string | null) => Promise<void>;
  onVerEnMapa: (imei: string) => void;
}) {
  const { t } = useI18n();
  const situacion = situacionEquipo(e, ahora);
  const tono = TONO_FILA[situacion.tono];
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
  const modelo = e.modelo?.trim().split(" ")[0] || (e.protocolo === "JT808" ? "SEG-9888G" : "Rastreador GT06");
  const td: React.CSSProperties = { padding: "11px 14px", borderBottom: `1px solid ${SURFACE.borderMuted}`, verticalAlign: "middle" };
  return (
    <tr style={{ background: enFoco ? "rgba(33,208,179,0.07)" : undefined }}>
      {/* Vehículo: el borde izquierdo lleva el color de la situación. */}
      <td style={{ ...td, paddingLeft: 18, boxShadow: `inset 3px 0 0 ${tono.punto}` }}>
        <button
          type="button"
          onClick={() => p && onVerEnMapa(e.imei)}
          disabled={!p}
          title={p ? t("Ver en el mapa") : undefined}
          style={{ display: "flex", alignItems: "center", gap: 11, background: "none", border: 0, padding: 0, textAlign: "left", cursor: p ? "pointer" : "default" }}
        >
          <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${BRAND.navy}, ${BRAND.navyLight})` }}>
            <CarIcon size={17} color={apagado ? SURFACE.textFaint : situacion.tono === "detenido" ? "#93c5fd" : tono.punto} strokeWidth={2.2} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 800, color: SURFACE.text, letterSpacing: e.vehiclePlate ? "0.05em" : 0, whiteSpace: "nowrap" }}>{nombreEquipo(e)}</span>
            <span style={{ display: "block", fontSize: 11, color: SURFACE.textFaint, whiteSpace: "nowrap" }}>{modelo}</span>
          </span>
        </button>
      </td>
      <td style={{ ...td, whiteSpace: "nowrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", borderRadius: 999, background: tono.bg, color: tono.fg, border: `1px solid ${tono.borde}`, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.03em", textTransform: "uppercase" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: tono.punto }} />
          {t(PASTILLA[situacion.tono])}
        </span>
        <div style={{ fontSize: 11, color: SURFACE.textFaint, marginTop: 4 }}>{hace(estado.edadPaqueteS)}</div>
      </td>
      <td style={{ ...td, whiteSpace: "nowrap", opacity: apagado ? 0.5 : 1 }}>
        {p ? (
          <>
            <span style={{ fontSize: 16, fontWeight: 800, color: SURFACE.text }}>{Math.round(p.velocidad)}</span>
            <span style={{ fontSize: 11, color: SURFACE.textMuted, marginLeft: 3 }}>km/h</span>
            {p.satelites > 0 && <div style={{ fontSize: 11, color: SURFACE.textFaint, marginTop: 2 }}>{p.satelites} sat.</div>}
          </>
        ) : (
          <span style={{ fontSize: 12, color: SURFACE.textFaint }}>{t("sin posición")}</span>
        )}
      </td>
      <td style={{ ...td, minWidth: 160 }}>
        {e.conductorNombre ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, color: SURFACE.text }}>{e.conductorNombre}</span>
            {e.tripId && (
              <span style={{ fontSize: 10, fontWeight: 800, color: STATE.successText, background: STATE.successSoft, border: `1px solid ${STATE.successBorder}`, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>{t("En viaje")}</span>
            )}
          </div>
        ) : (
          <span style={{ fontSize: 12, color: SURFACE.textFaint }}>{e.vehiclePlate ? t("Sin viaje hoy") : "—"}</span>
        )}
      </td>
      {/* Sin conexión es el último dato conocido: va atenuado. */}
      <td style={{ ...td, fontSize: 12, color: SURFACE.textSecondary, minWidth: 180, maxWidth: 300, lineHeight: 1.45, opacity: apagado ? 0.5 : 1 }}>
        {linea || <span style={{ color: SURFACE.textFaint }}>—</span>}
      </td>
      <td style={{ ...td, whiteSpace: "nowrap" }}>
        <SelectorPatente actual={e.vehiclePlate} conocidas={patentes} guardando={guardando} onElegir={elegir} />
        {(error || e.ultimoError) && <div style={{ fontSize: 11, color: STATE.dangerText, marginTop: 4, whiteSpace: "normal", maxWidth: 220 }}>{error ?? e.ultimoError}</div>}
      </td>
      <td style={{ ...td, textAlign: "right", paddingRight: 16 }}>
        <button
          type="button"
          onClick={() => onVerEnMapa(e.imei)}
          disabled={!p}
          title={t("Ver en el mapa")}
          aria-label={t("Ver en el mapa")}
          style={{
            width: 34,
            height: 34,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 9,
            border: `1px solid ${p ? "rgba(33,208,179,0.45)" : SURFACE.border}`,
            background: enFoco ? BRAND.teal : p ? "rgba(33,208,179,0.08)" : SURFACE.bg,
            cursor: p ? "pointer" : "not-allowed",
          }}
        >
          <MapPinnedIcon size={16} color={enFoco ? "#fff" : p ? BRAND.tealDark : SURFACE.textFaint} strokeWidth={2.4} />
        </button>
      </td>
    </tr>
  );
}

/**
 * Selector de patente con aspecto de placa: buscador, patentes conocidas del
 * evento, "usar como patente nueva" si lo escrito no existe, y quitar. La
 * lista se dibuja sobre la página (portal, posición fija): dentro de la tabla
 * con scroll horizontal se recortaba.
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
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const { lista, nueva } = opcionesPatente(conocidas, actual, texto);
  const items: { valor: string; nueva: boolean }[] = [...(nueva ? [{ valor: nueva, nueva: true }] : []), ...lista.map((p) => ({ valor: p, nueva: false }))];
  const ANCHO = 260;

  const ubicar = () => {
    if (!ref.current || typeof window === "undefined") return;
    const r = ref.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, window.innerWidth - ANCHO - 8));
    const dir = direccionDeLista(window.innerHeight - r.bottom, r.top, 330);
    setPos(dir === "abajo" ? { left, top: r.bottom + 6 } : { left, bottom: window.innerHeight - r.top + 6 });
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

  const lista_ = abierto && pos && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={popRef}
          role="listbox"
          style={{
            position: "fixed",
            left: pos.left,
            ...(pos.top != null ? { top: pos.top } : { bottom: pos.bottom }),
            width: ANCHO,
            zIndex: 10000,
            background: SURFACE.card,
            border: `1px solid ${SURFACE.border}`,
            borderRadius: 12,
            boxShadow: "0 14px 34px rgba(15,23,42,0.18)",
            padding: 8,
          }}
        >
          <div style={{ position: "relative" }}>
            <SearchIcon size={14} color={SURFACE.textFaint} strokeWidth={2.4} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input
              autoFocus
              type="text"
              value={texto}
              placeholder={t("Buscar o escribir patente…")}
              aria-label={t("Buscar o escribir patente…")}
              onChange={(ev) => { setTexto(ev.target.value); setActivo(0); }}
              onKeyDown={(ev) => {
                if (ev.key === "ArrowDown") { ev.preventDefault(); setActivo((i) => Math.min(items.length - 1, i + 1)); }
                else if (ev.key === "ArrowUp") { ev.preventDefault(); setActivo((i) => Math.max(0, i - 1)); }
                else if (ev.key === "Enter") { ev.preventDefault(); if (items[activo]) elegir(items[activo].valor); }
                else if (ev.key === "Escape") { ev.preventDefault(); setAbierto(false); }
              }}
              style={{ width: "100%", boxSizing: "border-box", height: 36, padding: "0 10px 0 31px", borderRadius: 8, border: `1px solid ${SURFACE.border}`, background: SURFACE.bg, fontSize: 13, color: SURFACE.text, outline: "none", textTransform: "uppercase" }}
            />
          </div>
          <div style={{ maxHeight: 216, overflowY: "auto", marginTop: 6 }}>
            {items.length === 0 && (
              <div style={{ padding: "10px 8px", fontSize: 12, color: SURFACE.textMuted }}>{t("Ninguna patente calza. Escribe la patente completa para agregarla.")}</div>
            )}
            {items.map((it, i) => (
              <button
                key={`${it.nueva ? "n" : "p"}-${it.valor}`}
                type="button"
                role="option"
                aria-selected={i === activo}
                onMouseEnter={() => setActivo(i)}
                onClick={() => elegir(it.valor)}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 8px", borderRadius: 8, border: 0, background: i === activo ? "rgba(33,208,179,0.10)" : "transparent", cursor: "pointer", textAlign: "left" }}
              >
                {it.nueva && <PlusIcon size={13} color={BRAND.tealDark} strokeWidth={2.6} />}
                <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5, fontWeight: 800, letterSpacing: "0.12em", color: SURFACE.text, background: "#fff", border: `1px solid ${SURFACE.borderStrong}`, borderRadius: 5, padding: "2px 7px" }}>
                  {it.valor}
                </span>
                {it.nueva && <span style={{ fontSize: 11.5, color: BRAND.tealInk, fontWeight: 700 }}>{t("patente nueva")}</span>}
              </button>
            ))}
          </div>
          {actual && (
            <button
              type="button"
              onClick={() => elegir(null)}
              style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", marginTop: 6, padding: "8px 8px 4px", border: 0, borderTop: `1px solid ${SURFACE.borderMuted}`, background: "transparent", color: STATE.dangerText, fontSize: 12.5, fontWeight: 700, cursor: "pointer", textAlign: "left" }}
            >
              <XIcon size={13} color={STATE.dangerText} strokeWidth={2.6} />
              {t("Quitar patente")} {actual}
            </button>
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <div ref={ref} style={{ display: "inline-block" }}>
      {actual ? (
        <button
          type="button"
          onClick={abrir}
          aria-haspopup="listbox"
          aria-expanded={abierto}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 8px 4px 10px",
            borderRadius: 7,
            border: `1.5px solid ${abierto ? BRAND.teal : SURFACE.textStrong}`,
            background: "#fff",
            boxShadow: abierto ? "0 0 0 3px rgba(33,208,179,0.14)" : "inset 0 -2px 0 rgba(15,23,42,0.06)",
            cursor: guardando ? "wait" : "pointer",
            opacity: guardando ? 0.6 : 1,
          }}
        >
          <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13, fontWeight: 800, letterSpacing: "0.14em", color: SURFACE.text }}>{actual}</span>
          <ChevronDownIcon size={13} color={SURFACE.textMuted} strokeWidth={2.5} style={{ transform: abierto ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }} />
        </button>
      ) : (
        <button
          type="button"
          onClick={abrir}
          aria-haspopup="listbox"
          aria-expanded={abierto}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 11px",
            borderRadius: 7,
            border: `1.5px dashed ${BRAND.teal}`,
            background: "rgba(33,208,179,0.06)",
            color: BRAND.tealInk,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: guardando ? "wait" : "pointer",
            opacity: guardando ? 0.6 : 1,
            whiteSpace: "nowrap",
          }}
        >
          <PlusIcon size={13} color={BRAND.tealDark} strokeWidth={2.6} />
          {guardando ? t("Guardando…") : t("Asignar patente")}
        </button>
      )}
      {lista_}
    </div>
  );
}
