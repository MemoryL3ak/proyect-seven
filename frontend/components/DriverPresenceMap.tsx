"use client";

import { useEffect, useRef } from "react";

export type PresenceMarker = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  online: boolean;
  lastSeen: string;
  gpsTime: string;
  activeTrips: number;
  platform: string | null;
};

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
  const infoWindowRef = useRef<any>(null);
  const didFitRef = useRef(false);

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
      Object.values(gmMarkersRef.current).forEach((m: any) => m.setMap(null));
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
        gmMarkersRef.current[id].setMap(null);
        delete gmMarkersRef.current[id];
      }
    });

    markers.forEach((m) => {
      const initials = getInitials(m.name);
      const accent = m.online ? "#10b981" : "#94a3b8";
      const pos = { lat: m.lat, lng: m.lng };

      const html = `
        <div style="font-family:system-ui,sans-serif;min-width:210px;padding:4px 0;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <div style="width:32px;height:32px;border-radius:50%;background:${accent};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;color:#fff;">${initials}</div>
            <div>
              <div style="font-weight:800;font-size:14px;color:#0f172a;">${m.name}</div>
              <div style="font-size:11px;font-weight:700;color:${accent};">${m.online ? "Conectado" : "Desconectado"}</div>
            </div>
          </div>
          <div style="font-size:12px;background:#f8fafc;border-radius:8px;padding:8px 10px;line-height:1.8;">
            <div><span style="color:#64748b;">Última conexión:</span> <b>${m.lastSeen}</b></div>
            <div><span style="color:#64748b;">GPS:</span> <b>${m.gpsTime}</b></div>
            <div><span style="color:#64748b;">Viajes activos:</span> <b>${m.activeTrips}</b></div>
            ${m.platform ? `<div><span style="color:#64748b;">Plataforma:</span> <b>${m.platform}</b></div>` : ""}
          </div>
        </div>
      `;

      if (gmMarkersRef.current[m.id]) {
        const marker = gmMarkersRef.current[m.id];
        marker.setPosition(pos);
        marker.setIcon({
          url: createPinIcon(initials, accent),
          scaledSize: new google.maps.Size(56, 68),
          anchor: new google.maps.Point(28, 66),
        });
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
          zIndex: m.online ? 20 : 10,
        });
        marker.__html = html;
        marker.addListener("click", () => {
          infoWindowRef.current.setContent(marker.__html);
          infoWindowRef.current.open(mapRef.current, marker);
        });
        gmMarkersRef.current[m.id] = marker;
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
