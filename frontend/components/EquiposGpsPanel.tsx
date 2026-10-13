"use client";

/**
 * "GPS de vehículos" en Monitoreo de conductores (rehecha el 13-10-2026,
 * Ariel: "esa tabla en general está muy fea, muy básica" y "el listbox se ve
 * pésimo"). Una tarjeta por equipo con el mismo lenguaje que la ficha del
 * mapa: patente en recuadro, situación con color, indicadores grandes,
 * conductor, y un selector de patente propio (buscador, patente nueva,
 * quitar) que no se recorta dentro de la tabla.
 */
import { useEffect, useRef, useState } from "react";
import { BRAND, STATE, SURFACE } from "@/lib/design";
import { useI18n } from "@/lib/i18n";
import { direccionDeLista, type DireccionLista } from "@/lib/desplegable";
import {
  estadoDeEquipo,
  fichaVehiculo,
  opcionesPatente,
  ordenarEquipos,
  resumenEquipos,
  type EquipoGps,
  type Situacion,
} from "@/lib/gps-vehiculos";
import { CarIcon, ChevronDownIcon, MapPinnedIcon, PlusIcon, SearchIcon, UserIcon, XIcon } from "@/components/ui/Icons";

/** Colores por situación sobre fondo claro (la ficha del mapa usa los mismos tonos sobre oscuro). */
export const TONO_TARJETA: Record<Situacion["tono"], { punto: string; bg: string; fg: string; borde: string; barra: string }> = {
  movimiento: { punto: STATE.success, bg: STATE.successSoft, fg: STATE.successText, borde: STATE.successBorder, barra: STATE.success },
  motor: { punto: STATE.warning, bg: STATE.warningSoft, fg: STATE.warningText, borde: STATE.warningBorder, barra: STATE.warning },
  detenido: { punto: STATE.info, bg: STATE.infoSoft, fg: STATE.infoText, borde: STATE.infoBorder, barra: STATE.info },
  sinConexion: { punto: SURFACE.textFaint, bg: SURFACE.borderMuted, fg: SURFACE.textMuted, borde: SURFACE.border, barra: SURFACE.borderStrong },
};

/** Resumen del encabezado, en singular y plural. */
const ETIQUETA_RESUMEN: Record<Situacion["tono"], [string, string]> = {
  movimiento: ["en movimiento", "en movimiento"],
  motor: ["detenido con motor encendido", "detenidos con motor encendido"],
  detenido: ["detenido", "detenidos"],
  sinConexion: ["sin conexión", "sin conexión"],
};

/** Pastilla corta de la tarjeta: la larga ("Detenido, motor encendido") cortaba el modelo. */
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
  return (
    <section style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: 16, boxShadow: "0 1px 4px rgba(15,23,42,0.04)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 10, padding: "16px 18px 14px", borderBottom: `1px solid ${SURFACE.borderMuted}` }}>
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
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: TONO_TARJETA[k].punto }} />
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
        <p className="p-6 text-sm" style={{ color: SURFACE.textMuted, margin: 0 }}>
          {t("Ningún equipo GPS se ha conectado todavía. Al apuntarlo al servidor (SMS SERVER) aparece acá con su IMEI, y se le asigna un vehículo.")}
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14, padding: 16 }}>
          {orden.map((e) => (
            <TarjetaEquipo
              key={e.imei}
              equipo={e}
              patentes={patentes}
              ahora={ahora}
              enFoco={focoImei === e.imei}
              onAsignar={onAsignar}
              onVerEnMapa={onVerEnMapa}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function TarjetaEquipo({
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
  const f = fichaVehiculo(e, ahora);
  const tono = TONO_TARJETA[f.situacion.tono];
  const tienePosicion = Boolean(e.ultimaPosicion);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const elegir = (plate: string | null) => {
    setGuardando(true);
    setError(null);
    onAsignar(e.imei, plate)
      .catch((err) => setError(err instanceof Error ? err.message : t("No se pudo asignar la patente")))
      .finally(() => setGuardando(false));
  };
  // Lo que el auto informa además de la velocidad (contacto, temperatura, batería…), en una línea.
  const extras = f.detalles.filter((d) => !["Conductor", "Viaje", "VIN", "Energía"].includes(d.label));
  const estado = estadoDeEquipo(e, ahora);
  return (
    <article
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        background: SURFACE.card,
        border: `1px solid ${enFoco ? BRAND.teal : SURFACE.border}`,
        borderTop: `3px solid ${tono.barra}`,
        borderRadius: 14,
        boxShadow: enFoco ? "0 0 0 3px rgba(33,208,179,0.16), 0 6px 18px rgba(15,23,42,0.08)" : "0 1px 3px rgba(15,23,42,0.05)",
        transition: "border-color 150ms ease, box-shadow 150ms ease",
      }}
    >
      {/* Encabezado: patente, nombre y situación. Pinchar lo muestra en el mapa. */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 14px 10px" }}>
        <button
          type="button"
          onClick={() => tienePosicion && onVerEnMapa(e.imei)}
          disabled={!tienePosicion}
          title={tienePosicion ? t("Ver en el mapa") : undefined}
          style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1, background: "none", border: 0, padding: 0, textAlign: "left", cursor: tienePosicion ? "pointer" : "default" }}
        >
          <span
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              flexShrink: 0,
              background: `linear-gradient(135deg, ${BRAND.navy}, ${BRAND.navyLight})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 6px rgba(4,26,46,0.25)",
            }}
          >
            {/* La patente ya es el título: acá va el auto, con el color de su situación. */}
            <CarIcon size={22} color={f.situacion.tono === "sinConexion" ? SURFACE.textFaint : tono.punto === STATE.info ? "#93c5fd" : tono.punto} strokeWidth={2.2} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 16, fontWeight: 800, color: SURFACE.text, lineHeight: 1.2, letterSpacing: e.vehiclePlate ? "0.04em" : 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nombre}</span>
            <span style={{ display: "block", fontSize: 11.5, color: SURFACE.textMuted, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.subtitulo}</span>
          </span>
        </button>
      </div>
      {/* Situación en su propia línea: al lado del nombre lo cortaba ("JJJC…") con el ancho real del panel. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 14px 10px" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 999,
            background: tono.bg,
            color: tono.fg,
            border: `1px solid ${tono.borde}`,
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: tono.punto }} />
          {t(PASTILLA[f.situacion.tono])}
        </span>
        <span style={{ fontSize: 11, color: SURFACE.textFaint, whiteSpace: "nowrap" }}>
          {t("Último dato")} {f.actualizado}
        </span>
      </div>

      {/* Indicadores grandes; sin conexión son los últimos conocidos y van atenuados. */}
      <div style={{ display: "flex", gap: 8, padding: "0 14px", opacity: f.situacion.tono === "sinConexion" ? 0.55 : 1 }}>
        {f.indicadores.length > 0 ? (
          f.indicadores.map((i) => (
            <div key={i.label} style={{ flex: "1 1 0", minWidth: 0, background: SURFACE.bg, border: `1px solid ${SURFACE.borderMuted}`, borderRadius: 10, padding: "9px 6px 7px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: SURFACE.text, lineHeight: 1, whiteSpace: "nowrap" }}>
                {i.valor}
                {i.unidad && <span style={{ fontSize: 10.5, fontWeight: 700, color: SURFACE.textMuted, marginLeft: 2 }}>{i.unidad}</span>}
              </div>
              <div style={{ fontSize: 9.5, fontWeight: 800, color: SURFACE.textFaint, marginTop: 5, textTransform: "uppercase", letterSpacing: "0.08em" }}>{t(i.label)}</div>
            </div>
          ))
        ) : (
          <div style={{ flex: 1, background: SURFACE.bg, border: `1px dashed ${SURFACE.border}`, borderRadius: 10, padding: "12px 10px", fontSize: 12, color: SURFACE.textMuted, textAlign: "center" }}>
            {t("Todavía no manda posición: necesita el auto encendido y cielo abierto.")}
          </div>
        )}
      </div>
      {extras.length > 0 && (
        <div style={{ padding: "8px 14px 0", fontSize: 11.5, color: SURFACE.textSecondary, lineHeight: 1.5 }}>
          {extras.map((d) => `${t(d.label)} ${d.value}`).join(" · ")}
        </div>
      )}

      {/* Conductor */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 14px 0", padding: "9px 10px", borderRadius: 10, background: e.conductorNombre ? "rgba(33,208,179,0.06)" : SURFACE.bg }}>
        <span style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: e.conductorNombre ? BRAND.teal : SURFACE.border }}>
          <UserIcon size={14} color={e.conductorNombre ? "#fff" : SURFACE.textMuted} strokeWidth={2.4} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: SURFACE.textFaint, textTransform: "uppercase", letterSpacing: "0.08em" }}>{t("Conductor")}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: e.conductorNombre ? SURFACE.text : SURFACE.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {e.conductorNombre ?? (e.vehiclePlate ? t("Sin viaje hoy con esta patente") : t("Asigna una patente para ver al conductor"))}
          </div>
        </div>
        {e.tripId && (
          <span style={{ fontSize: 10.5, fontWeight: 800, color: STATE.successText, background: STATE.successSoft, border: `1px solid ${STATE.successBorder}`, borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap" }}>
            {t("En viaje")}
          </span>
        )}
      </div>

      {/* Patente y mapa */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10, margin: "12px 14px 0", paddingTop: 12, borderTop: `1px solid ${SURFACE.borderMuted}` }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: SURFACE.textFaint, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>{t("Patente")}</div>
          <SelectorPatente actual={e.vehiclePlate} conocidas={patentes} guardando={guardando} onElegir={elegir} />
        </div>
        <button
          type="button"
          onClick={() => onVerEnMapa(e.imei)}
          disabled={!tienePosicion}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            borderRadius: 9,
            border: `1px solid ${tienePosicion ? "rgba(33,208,179,0.45)" : SURFACE.border}`,
            background: tienePosicion ? "rgba(33,208,179,0.08)" : SURFACE.bg,
            color: tienePosicion ? BRAND.tealInk : SURFACE.textFaint,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: tienePosicion ? "pointer" : "not-allowed",
            whiteSpace: "nowrap",
          }}
        >
          <MapPinnedIcon size={14} color={tienePosicion ? BRAND.tealDark : SURFACE.textFaint} strokeWidth={2.4} />
          {t("Ver en mapa")}
        </button>
      </div>
      {(error || e.ultimoError) && <div style={{ margin: "8px 14px 0", fontSize: 11.5, color: STATE.dangerText }}>{error ?? e.ultimoError}</div>}

      <div style={{ marginTop: "auto", padding: "10px 14px 12px", fontSize: 10.5, color: SURFACE.textFaint, lineHeight: 1.5 }}>
        {f.pie[0]}
        {estado.conectado && e.energiaExterna === false && <span style={{ color: STATE.warningText }}> · {t("con batería interna")}</span>}
      </div>
    </article>
  );
}

/**
 * Selector de patente con aspecto de placa: buscador, patentes conocidas del
 * evento, "usar como patente nueva" si lo escrito no existe, y quitar.
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
  const [direccion, setDireccion] = useState<DireccionLista>("abajo");
  const ref = useRef<HTMLDivElement>(null);
  const { lista, nueva } = opcionesPatente(conocidas, actual, texto);
  const items: { valor: string; nueva: boolean }[] = [...(nueva ? [{ valor: nueva, nueva: true }] : []), ...lista.map((p) => ({ valor: p, nueva: false }))];

  useEffect(() => {
    if (!abierto) return;
    const fuera = (ev: MouseEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  const abrir = () => {
    if (guardando) return;
    if (!abierto && ref.current && typeof window !== "undefined") {
      const r = ref.current.getBoundingClientRect();
      setDireccion(direccionDeLista(window.innerHeight - r.bottom, r.top, 330));
    }
    setTexto("");
    setActivo(0);
    setAbierto((v) => !v);
  };
  const elegir = (p: string | null) => {
    setAbierto(false);
    if (p !== actual) onElegir(p);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
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
            padding: "5px 8px 5px 10px",
            borderRadius: 8,
            border: `1.5px solid ${abierto ? BRAND.teal : SURFACE.textStrong}`,
            background: "#fff",
            boxShadow: abierto ? "0 0 0 3px rgba(33,208,179,0.14)" : "inset 0 -2px 0 rgba(15,23,42,0.06)",
            cursor: guardando ? "wait" : "pointer",
            opacity: guardando ? 0.6 : 1,
          }}
        >
          <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 14, fontWeight: 800, letterSpacing: "0.14em", color: SURFACE.text }}>{actual}</span>
          <ChevronDownIcon size={14} color={SURFACE.textMuted} strokeWidth={2.5} style={{ transform: abierto ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }} />
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
            padding: "7px 12px",
            borderRadius: 8,
            border: `1.5px dashed ${BRAND.teal}`,
            background: "rgba(33,208,179,0.06)",
            color: BRAND.tealInk,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: guardando ? "wait" : "pointer",
            opacity: guardando ? 0.6 : 1,
          }}
        >
          <PlusIcon size={14} color={BRAND.tealDark} strokeWidth={2.6} />
          {guardando ? t("Guardando…") : t("Asignar patente")}
        </button>
      )}

      {abierto && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            left: 0,
            ...(direccion === "arriba" ? { bottom: "calc(100% + 6px)" } : { top: "calc(100% + 6px)" }),
            width: 260,
            zIndex: 60,
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
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "7px 8px",
                  borderRadius: 8,
                  border: 0,
                  background: i === activo ? "rgba(33,208,179,0.10)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {it.nueva && <PlusIcon size={13} color={BRAND.tealDark} strokeWidth={2.6} />}
                <span
                  style={{
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 12.5,
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    color: SURFACE.text,
                    background: "#fff",
                    border: `1px solid ${SURFACE.borderStrong}`,
                    borderRadius: 5,
                    padding: "2px 7px",
                  }}
                >
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
        </div>
      )}
    </div>
  );
}
