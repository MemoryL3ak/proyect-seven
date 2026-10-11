"use client";

import { useEffect, useRef, useState } from "react";
import { BRAND, STATE, SURFACE, ACCENT } from "@/lib/design";
import { etiquetaPlataforma } from "@/lib/plataforma-conductor";
import { rotuloMarcador } from "@/lib/presencia";
import type { FichaVehiculo, Situacion } from "@/lib/gps-vehiculos";

export type PresenceMarker = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  /** Posición reciente (menos de un minuto). */
  online: boolean;
  /** App abierta y latiendo, tenga o no GPS. */
  conectado?: boolean;
  // True when the driver is currently on an active trip (heading to pickup or
  // with the passenger aboard). Drives the "En viaje" green highlight.
  onTrip: boolean;
  // Human label for the trip state ("Va en camino", "Pasajero a bordo"…).
  tripLabel: string | null;
  lastSeen: string;
  gpsTime: string;
  activeTrips: number;
  platform: string | null;
  // Tipos de cliente que el conductor puede transportar (VIP, T1, TA, …).
  clientTypes: string[];
  // Filas extra para el recuadro de detalle (label → valor). Permite que cada
  // monitor (conductores, VIP…) enriquezca el popup sin tocar este componente.
  detailRows?: { label: string; value: string }[];
  /**
   * Ficha del vehículo (GPS instalado en el auto, 11-10-2026). Cuando viene,
   * la burbuja es otra: cabecera oscura con patente y situación, indicadores
   * grandes y detalles en dos columnas, sin "viajes activos", "plataforma" ni
   * tipos de cliente, que no tienen sentido para un equipo.
   */
  fichaVehiculo?: FichaVehiculo;
  /** Titular del estado bajo el nombre ("En movimiento", "Detenido, motor encendido"…). */
  estadoTexto?: string;
  /** Texto del pin cuando las iniciales del nombre no sirven (patente, "GPS"). */
  iniciales?: string;
};

// Pastilla de situación sobre la cabecera oscura de la ficha del vehículo.
const TONO_SITUACION: Record<Situacion["tono"], { bg: string; fg: string; punto: string }> = {
  movimiento: { bg: "rgba(16,185,129,0.22)", fg: STATE.successBorder, punto: STATE.success },
  motor: { bg: "rgba(245,158,11,0.22)", fg: STATE.warningBorder, punto: STATE.warning },
  detenido: { bg: "rgba(255,255,255,0.12)", fg: SURFACE.border, punto: SURFACE.borderStrong },
  sinConexion: { bg: "rgba(239,68,68,0.2)", fg: STATE.dangerBorder, punto: STATE.danger },
};

export function fichaVehiculoHtml(f: FichaVehiculo): string {
  const tono = TONO_SITUACION[f.situacion.tono];
  const indicadores = f.indicadores
    .map(
      (i) => `
      <div style="flex:1 1 0;min-width:0;max-width:140px;background:${SURFACE.bg};border:1px solid ${SURFACE.borderMuted};border-radius:10px;padding:9px 6px 7px;text-align:center;">
        <div style="font-size:19px;font-weight:900;color:${SURFACE.text};line-height:1;letter-spacing:-0.01em;white-space:nowrap;">${i.valor}${i.unidad ? `<span style="font-size:10px;font-weight:700;color:${SURFACE.textMuted};margin-left:2px;">${i.unidad}</span>` : ""}</div>
        <div style="font-size:9px;font-weight:800;color:${SURFACE.textFaint};margin-top:5px;text-transform:uppercase;letter-spacing:0.08em;">${i.label}</div>
      </div>`,
    )
    .join("");
  const detalles = f.detalles
    .map(
      (d) => `
      <div style="min-width:0;">
        <div style="font-size:9.5px;font-weight:700;color:${SURFACE.textFaint};text-transform:uppercase;letter-spacing:0.06em;">${d.label}</div>
        <div style="font-size:12px;font-weight:700;color:${SURFACE.text};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${d.value}">${d.value}</div>
      </div>`,
    )
    .join("");
  return `
    <div style="font-family:system-ui,sans-serif;width:300px;color:${SURFACE.text};">
      <div style="background:linear-gradient(135deg,${BRAND.navy},${BRAND.navyLight} 55%,${BRAND.charcoal});padding:14px 44px 12px 14px;color:#fff;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:46px;height:46px;border-radius:12px;flex-shrink:0;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.22);display:flex;align-items:center;justify-content:center;font-size:${f.insignia.length > 3 ? 12 : 13}px;font-weight:900;letter-spacing:0.04em;color:${BRAND.tealLight};">${f.insignia}</div>
          <div style="min-width:0;flex:1;">
            <div style="font-size:16px;font-weight:800;line-height:1.15;word-break:break-word;">${f.nombre}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.72);margin-top:3px;">${f.subtitulo}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:11px;">
          <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:${tono.bg};color:${tono.fg};font-size:9.5px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;white-space:nowrap;">
            <span style="width:6px;height:6px;border-radius:50%;background:${tono.punto};"></span>${f.situacion.texto}
          </span>
          <span style="font-size:10.5px;color:rgba(255,255,255,0.65);white-space:nowrap;">${f.actualizado}</span>
        </div>
      </div>
      ${f.indicadores.length ? `<div style="display:flex;justify-content:center;gap:8px;padding:12px 14px 2px;">${indicadores}</div>` : ""}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px 12px;padding:12px 14px;">${detalles}</div>
      <div style="border-top:1px solid ${SURFACE.borderMuted};padding:8px 14px 10px;">
        ${f.pie.map((l) => `<div style="font-size:10.5px;color:${SURFACE.textMuted};line-height:1.5;">${l}</div>`).join("")}
      </div>
    </div>`;
}

// Colores de chip por tipo de cliente — mismos tonos que la tabla de monitoreo.
const CLIENT_TYPE_CHIP: Record<string, { label: string; bg: string; color: string; border: string }> = {
  VIP: { label: "VIP", bg: STATE.warningSoft, color: STATE.warningText, border: STATE.warning },
  T1: { label: "T1", bg: STATE.dangerSoft, color: STATE.dangerText, border: STATE.dangerBorder },
  TA: { label: "TA", bg: STATE.infoSoft, color: STATE.infoText, border: STATE.infoBorder },
  TF: { label: "TF", bg: "#e0f2fe", color: "#075985", border: "#7dd3fc" },
  TM: { label: "TM", bg: ACCENT.violetSoft, color: "#5b21b6", border: "#c4b5fd" },
  FAMILIA_PARAPAN: { label: "Familia Parapan", bg: "#fce7f3", color: "#9d174d", border: "#f9a8d4" },
  JEFE_MISION: { label: "Jefe de Misión", bg: "#ccfbf1", color: "#0f766e", border: "#5eead4" },
  COMITE_ORGANIZADOR: { label: "Comité Org.", bg: "#e0f2fe", color: "#075985", border: "#7dd3fc" },
  PROVEEDORES: { label: "Proveedores", bg: SURFACE.borderMuted, color: SURFACE.textStrong, border: SURFACE.borderStrong },
};

function clientTypeChipsHtml(types: string[]): string {
  if (!types || types.length === 0) {
    // Sin tipos declarados = el conductor puede tomar cualquier tipo de
    // cliente (misma regla que usa el motor de auto-asignación).
    return `<span style="display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;padding:3px 9px;border-radius:99px;background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;">
      <span style="width:6px;height:6px;border-radius:50%;background:#10b981;"></span>
      Todos los tipos · sin restricción declarada
    </span>`;
  }
  return types
    .map((t) => {
      const c = CLIENT_TYPE_CHIP[String(t).toUpperCase()] ?? { label: t, bg: SURFACE.borderMuted, color: SURFACE.textSecondary, border: SURFACE.borderStrong };
      return `<span style="display:inline-block;font-size:9.5px;font-weight:700;padding:3px 8px;border-radius:99px;background:${c.bg};color:${c.color};border:1px solid ${c.border};letter-spacing:0.04em;text-transform:uppercase;margin:2px 4px 0 0;">${c.label}</span>`;
    })
    .join("");
}

// Marker accent per state: on an active trip = green, online-only = blue,
// stale/last-known = grey. Kept in one place so the pin icon, the info window
// and the zIndex all agree.
function markerAccent(m: PresenceMarker): string {
  if (m.onTrip) return STATE.success;
  if (m.online) return STATE.infoText;
  return SURFACE.textFaint;
}

function markerStatusLabel(m: PresenceMarker): string {
  return rotuloMarcador({ onTrip: m.onTrip, gpsVivo: m.online, conectado: m.conectado, tripLabel: m.tripLabel });
}

type Props = {
  markers: PresenceMarker[];
  height?: number;
  /**
   * Chofer al que centrar el mapa. Se usa cuando se llega desde el banner
   * "Ahora mismo" tocando un traslado: sin esto, con ocho buses en pantalla,
   * el jefe tenía que adivinar cuál era el que venía a mirar.
   */
  focoId?: string | null;
};

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return;
    if ((window as any).google?.maps?.Map) {
      resolve();
      return;
    }
    const existing = document.getElementById("google-maps-script");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function getInitials(name: string): string {
  return (
    name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase() || "?"
  );
}

function createPinIcon(initials: string, accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="68" viewBox="0 0 56 68">
    <defs>
      <filter id="ds" x="-30%" y="-20%" width="160%" height="150%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.35"/>
      </filter>
    </defs>
    <path d="M28 66 L19 48 L37 48 Z" fill="${accent}" opacity="0.9"/>
    <circle cx="28" cy="26" r="23" fill="${accent}" filter="url(%23ds)"/>
    <circle cx="28" cy="26" r="20" fill="#062240"/>
    <text x="28" y="32" text-anchor="middle" font-family="system-ui,sans-serif" font-size="15" font-weight="900" fill="#fff" letter-spacing="0.5">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export default function DriverPresenceMap({ markers, height = 420, focoId = null }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  // Último chofer al que se centró, para no repetir el movimiento en cada tic.
  const focoAplicadoRef = useRef<string | null>(null);
  // El mapa de Google se carga aparte y puede llegar DESPUÉS de los
  // marcadores. Sin esta señal, el encuadre se perdía: el efecto salía sin
  // hacer nada y no volvía a entrar hasta el siguiente refresco, así que el
  // mapa se quedaba en su centro por defecto (Santiago) con el bus fuera.
  const [mapaListo, setMapaListo] = useState(false);
  const gmMarkersRef = useRef<Record<string, any>>({});
  // Last accent applied per marker — drives icon regeneration only when the
  // online/offline color actually flips (the markers array re-renders every
  // second from the freshness tick, so we must not rebuild icons each time).
  const markerAccentRef = useRef<Record<string, string>>({});
  // Per-marker animation state — interpolates a marker between its previous
  // fix and the new one so movement looks fluid instead of "teleporting"
  // every realtime push. Mirrors LiveTrackingMap's approach.
  const markerAnimRef = useRef<
    Record<string, { rafId: number; from: { lat: number; lng: number }; to: { lat: number; lng: number } }>
  >({});
  const infoWindowRef = useRef<any>(null);
  const didFitRef = useRef(false);

  // Smoothly animates a marker to `to`, cancelling any in-flight tween for the
  // same marker. 1200 ms sits just under the typical gap between GPS fixes so
  // the marker arrives shortly before the next one lands.
  const ANIM_DURATION_MS = 1200;
  const animateMarker = (
    markerId: string,
    marker: any,
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ) => {
    const prev = markerAnimRef.current[markerId];
    if (prev) cancelAnimationFrame(prev.rafId);
    const startedAt = performance.now();
    const step = (now: number) => {
      const elapsed = now - startedAt;
      const t = Math.min(1, elapsed / ANIM_DURATION_MS);
      // ease-out cubic: starts fast, settles gently.
      const eased = 1 - Math.pow(1 - t, 3);
      const lat = from.lat + (to.lat - from.lat) * eased;
      const lng = from.lng + (to.lng - from.lng) * eased;
      marker.setPosition({ lat, lng });
      if (t < 1) {
        markerAnimRef.current[markerId] = { rafId: requestAnimationFrame(step), from, to };
      } else {
        delete markerAnimRef.current[markerId];
      }
    };
    markerAnimRef.current[markerId] = { rafId: requestAnimationFrame(step), from, to };
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    loadGoogleMaps().then(() => {
      if (cancelled || !containerRef.current) return;
      const google = (window as any).google;
      mapRef.current = new google.maps.Map(containerRef.current, {
        center: { lat: -33.45, lng: -70.65 },
        zoom: 11,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        gestureHandling: "greedy",
        styles: [
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
      });
      setMapaListo(true);
      infoWindowRef.current = new google.maps.InfoWindow({ maxWidth: 300 });
    });

    return () => {
      cancelled = true;
      Object.values(markerAnimRef.current).forEach((a) => cancelAnimationFrame(a.rafId));
      Object.values(gmMarkersRef.current).forEach((m: any) => m.setMap(null));
      markerAnimRef.current = {};
      gmMarkersRef.current = {};
      mapRef.current = null;
      didFitRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const google = (window as any).google;
    if (!google?.maps) return;

    const currentIds = new Set(markers.map((m) => m.id));

    Object.keys(gmMarkersRef.current).forEach((id) => {
      if (!currentIds.has(id)) {
        const inflight = markerAnimRef.current[id];
        if (inflight) cancelAnimationFrame(inflight.rafId);
        delete markerAnimRef.current[id];
        gmMarkersRef.current[id].setMap(null);
        delete gmMarkersRef.current[id];
        delete markerAccentRef.current[id];
      }
    });

    markers.forEach((m) => {
      const initials = m.iniciales ?? getInitials(m.name);
      const accent = markerAccent(m);
      const statusLabel = m.estadoTexto ?? markerStatusLabel(m);
      const zIndex = m.onTrip ? 30 : m.online ? 20 : 10;
      const pos = { lat: m.lat, lng: m.lng };

      const statRow = (label: string, value: string) => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:5px 0;">
          <span style="font-size:11px;color:#64748b;white-space:nowrap;">${label}</span>
          <span style="font-size:11.5px;font-weight:700;color:#0f172a;text-align:right;">${value}</span>
        </div>`;
      const html = m.fichaVehiculo ? fichaVehiculoHtml(m.fichaVehiculo) : `
        <div style="font-family:system-ui,sans-serif;min-width:230px;max-width:270px;padding:2px 2px 4px;">
          <!-- padding-right: la X de cerrar de Google va sobre la esquina y tapaba
               el final del nombre; word-break: un nombre largo baja de línea en
               vez de meterse debajo de la X. -->
          <div style="display:flex;align-items:center;gap:10px;padding:0 18px 9px 0;border-bottom:1px solid #eef2f7;">
            <div style="width:36px;height:36px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,${accent},${accent}cc);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;color:#fff;box-shadow:0 2px 6px ${accent}55;">${initials}</div>
            <div style="min-width:0;">
              <div style="font-weight:800;font-size:14px;color:#0f172a;line-height:1.2;word-break:break-word;">${m.name}</div>
              <div style="display:inline-flex;align-items:center;gap:5px;margin-top:2px;font-size:10px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;color:${accent};">
                <span style="width:6px;height:6px;border-radius:50%;background:${accent};"></span>${statusLabel}
              </div>
            </div>
          </div>
          <div style="padding:6px 0 2px;">
            ${statRow("Última conexión", m.lastSeen)}
            ${statRow("Señal GPS", m.gpsTime)}
            ${statRow("Viajes activos", String(m.activeTrips))}
            ${m.platform ? statRow("Plataforma", etiquetaPlataforma(m.platform)?.texto ?? m.platform) : ""}
            ${(m.detailRows ?? []).map((r) => statRow(r.label, r.value)).join("")}
          </div>
          <div style="margin-top:6px;padding-top:8px;border-top:1px solid #eef2f7;">
            <div style="font-size:9.5px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#94a3b8;margin-bottom:5px;">Tipos de cliente</div>
            ${clientTypeChipsHtml(m.clientTypes)}
          </div>
        </div>
      `;

      if (gmMarkersRef.current[m.id]) {
        const marker = gmMarkersRef.current[m.id];
        const currentPos = marker.getPosition?.();
        const from = currentPos ? { lat: currentPos.lat(), lng: currentPos.lng() } : pos;
        // Only animate when the fix actually moved — avoids a spurious tween
        // on every refresh when a driver is parked.
        const moved = Math.abs(from.lat - pos.lat) > 1e-7 || Math.abs(from.lng - pos.lng) > 1e-7;
        if (moved) {
          animateMarker(m.id, marker, from, pos);
        } else {
          marker.setPosition(pos);
        }
        if (markerAccentRef.current[m.id] !== accent) {
          marker.setIcon({
            url: createPinIcon(initials, accent),
            scaledSize: new google.maps.Size(56, 68),
            anchor: new google.maps.Point(28, 66),
          });
          marker.setZIndex(zIndex);
          markerAccentRef.current[m.id] = accent;
        }
        marker.__html = html;
        marker.__ficha = Boolean(m.fichaVehiculo);
      } else {
        const marker = new google.maps.Marker({
          position: pos,
          map: mapRef.current,
          icon: {
            url: createPinIcon(initials, accent),
            scaledSize: new google.maps.Size(56, 68),
            anchor: new google.maps.Point(28, 66),
          },
          title: m.name,
          zIndex,
        });
        marker.__html = html;
        marker.__ficha = Boolean(m.fichaVehiculo);
        marker.addListener("click", () => {
          infoWindowRef.current.setContent(marker.__html);
          infoWindowRef.current.open(mapRef.current, marker);
          // La ficha del vehículo va al borde de la burbuja (cabecera oscura,
          // X en blanco): la clase la pone globals.css (.ficha-gps).
          const esFicha = Boolean(marker.__ficha);
          google.maps.event.addListenerOnce(infoWindowRef.current, "domready", () => {
            containerRef.current?.querySelectorAll(".gm-style-iw-c").forEach((el) => el.classList.toggle("ficha-gps", esFicha));
          });
        });
        gmMarkersRef.current[m.id] = marker;
        markerAccentRef.current[m.id] = accent;
      }
    });

    // Con un chofer señalado, el mapa va a él y se olvida del encuadre
    // automático: es lo que la persona vino a ver.
    if (focoId) {
      const m = markers.find((x) => x.id === focoId);
      if (m && focoAplicadoRef.current !== focoId) {
        mapRef.current.panTo({ lat: m.lat, lng: m.lng });
        mapRef.current.setZoom(15);
        focoAplicadoRef.current = focoId;
        didFitRef.current = true;
        return;
      }
    } else {
      focoAplicadoRef.current = null;
    }

    if (markers.length > 0 && !didFitRef.current) {
      const bounds = new google.maps.LatLngBounds();
      markers.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));
      if (markers.length === 1) {
        mapRef.current.setCenter({ lat: markers[0].lat, lng: markers[0].lng });
        mapRef.current.setZoom(14);
      } else {
        mapRef.current.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
      }
      didFitRef.current = true;
    }
  }, [markers, focoId, mapaListo]);

  return (
    // La clase permite que la ficha del conductor (InfoWindow) crezca entera
    // en vez de recortarse con scroll: ver .mapa-conductores en globals.css.
    <div ref={containerRef} className="mapa-conductores" style={{ width: "100%", height: `${height}px`, borderRadius: 12 }} />
  );
}
