"use client";

import { useEffect, useRef } from "react";

export type PresenceMarker = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  online: boolean;
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
};

// Colores de chip por tipo de cliente — mismos tonos que la tabla de monitoreo.
const CLIENT_TYPE_CHIP: Record<string, { label: string; bg: string; color: string; border: string }> = {
  VIP: { label: "VIP", bg: "#fef3c7", color: "#7a4a00", border: "#fcd34d" },
  T1: { label: "T1", bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" },
  TA: { label: "TA", bg: "#dbeafe", color: "#1e40af", border: "#93c5fd" },
  TF: { label: "TF", bg: "#e0f2fe", color: "#075985", border: "#7dd3fc" },
  TM: { label: "TM", bg: "#ede9fe", color: "#5b21b6", border: "#c4b5fd" },
  FAMILIA_PARAPAN: { label: "Familia Parapan", bg: "#fce7f3", color: "#9d174d", border: "#f9a8d4" },
  COMITE_ORGANIZADOR: { label: "Comité Org.", bg: "#e0f2fe", color: "#075985", border: "#7dd3fc" },
  PROVEEDORES: { label: "Proveedores", bg: "#f1f5f9", color: "#334155", border: "#cbd5e1" },
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
      const c = CLIENT_TYPE_CHIP[String(t).toUpperCase()] ?? { label: t, bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" };
      return `<span style="display:inline-block;font-size:9.5px;font-weight:700;padding:3px 8px;border-radius:99px;background:${c.bg};color:${c.color};border:1px solid ${c.border};letter-spacing:0.04em;text-transform:uppercase;margin:2px 4px 0 0;">${c.label}</span>`;
    })
    .join("");
}

// Marker accent per state: on an active trip = green, online-only = blue,
// stale/last-known = grey. Kept in one place so the pin icon, the info window
// and the zIndex all agree.
function markerAccent(m: PresenceMarker): string {
  if (m.onTrip) return "#10b981";
  if (m.online) return "#2563eb";
  return "#94a3b8";
}

function markerStatusLabel(m: PresenceMarker): string {
  if (m.onTrip) return m.tripLabel || "En viaje";
  if (m.online) return "En línea";
  return "Desconectado";
}

type Props = {
  markers: PresenceMarker[];
  height?: number;
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

export default function DriverPresenceMap({ markers, height = 420 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
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
      infoWindowRef.current = new google.maps.InfoWindow();
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
      const initials = getInitials(m.name);
      const accent = markerAccent(m);
      const statusLabel = markerStatusLabel(m);
      const zIndex = m.onTrip ? 30 : m.online ? 20 : 10;
      const pos = { lat: m.lat, lng: m.lng };

      const statRow = (label: string, value: string) => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:5px 0;">
          <span style="font-size:11px;color:#64748b;white-space:nowrap;">${label}</span>
          <span style="font-size:11.5px;font-weight:700;color:#0f172a;text-align:right;">${value}</span>
        </div>`;
      const html = `
        <div style="font-family:system-ui,sans-serif;min-width:230px;max-width:270px;padding:2px 2px 4px;">
          <div style="display:flex;align-items:center;gap:10px;padding-bottom:9px;border-bottom:1px solid #eef2f7;">
            <div style="width:36px;height:36px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,${accent},${accent}cc);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;color:#fff;box-shadow:0 2px 6px ${accent}55;">${initials}</div>
            <div style="min-width:0;">
              <div style="font-weight:800;font-size:14px;color:#0f172a;line-height:1.2;">${m.name}</div>
              <div style="display:inline-flex;align-items:center;gap:5px;margin-top:2px;font-size:10px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;color:${accent};">
                <span style="width:6px;height:6px;border-radius:50%;background:${accent};"></span>${statusLabel}
              </div>
            </div>
          </div>
          <div style="padding:6px 0 2px;">
            ${statRow("Última conexión", m.lastSeen)}
            ${statRow("Señal GPS", m.gpsTime)}
            ${statRow("Viajes activos", String(m.activeTrips))}
            ${m.platform ? statRow("Plataforma", m.platform) : ""}
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
        marker.addListener("click", () => {
          infoWindowRef.current.setContent(marker.__html);
          infoWindowRef.current.open(mapRef.current, marker);
        });
        gmMarkersRef.current[m.id] = marker;
        markerAccentRef.current[m.id] = accent;
      }
    });

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
  }, [markers]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: `${height}px`, borderRadius: 12 }} />
  );
}
