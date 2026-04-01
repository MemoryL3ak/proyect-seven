"use client";

import { useEffect, useRef } from "react";

export type TrackingMarker = {
  tripId: string;
  lat: number;
  lng: number;
  driverName: string;
  vehiclePlate: string;
  statusLabel: string;
  accent: string;
  origin: string;
  destination: string;
  elapsedMin: number | null;
  gpsTime: string;
};

type Props = {
  markers: TrackingMarker[];
  height?: number;
  isDark?: boolean;
};

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return;
    if ((window as any).google?.maps?.Map) { resolve(); return; }
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
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase() || "?";
}

function createDriverCarIcon(initials: string, accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="72" viewBox="0 0 64 72">
    <defs>
      <filter id="ds" x="-20%" y="-10%" width="140%" height="130%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.35"/>
      </filter>
    </defs>
    <!-- Pointer -->
    <path d="M32 68 L24 52 L40 52 Z" fill="${accent}" opacity="0.9"/>
    <!-- Circle background -->
    <circle cx="32" cy="28" r="26" fill="${accent}" filter="url(%23ds)"/>
    <circle cx="32" cy="28" r="23" fill="#062240"/>
    <!-- Car body -->
    <g transform="translate(14,16)">
      <rect x="4" y="10" width="28" height="11" rx="3" fill="${accent}" opacity="0.9"/>
      <path d="M7 10 L11 3 L25 3 L29 10" fill="${accent}" opacity="0.6"/>
      <circle cx="10" cy="21" r="2.5" fill="#062240" stroke="#fff" stroke-width="1.2"/>
      <circle cx="26" cy="21" r="2.5" fill="#062240" stroke="#fff" stroke-width="1.2"/>
      <rect x="1" y="13" width="3" height="2" rx="1" fill="#FFD700" opacity="0.8"/>
      <rect x="32" y="13" width="3" height="2" rx="1" fill="#FF4444" opacity="0.8"/>
    </g>
    <!-- Initials -->
    <text x="32" y="35" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="900" fill="#fff" letter-spacing="0.5">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export default function LiveTrackingMap({ markers, height = 560 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const gmMarkersRef = useRef<Record<string, any>>({});
  const infoWindowRef = useRef<any>(null);
  const didFitRef = useRef(false);

  // Init map once
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

  // Update markers
  useEffect(() => {
    if (!mapRef.current) return;
    const google = (window as any).google;
    if (!google?.maps) return;

    const currentIds = new Set(markers.map((m) => m.tripId));

    // Remove stale markers
    Object.keys(gmMarkersRef.current).forEach((id) => {
      if (!currentIds.has(id)) {
        gmMarkersRef.current[id].setMap(null);
        delete gmMarkersRef.current[id];
      }
    });

    // Add or update markers
    markers.forEach((m) => {
      const initials = getInitials(m.driverName);
      const pos = { lat: m.lat, lng: m.lng };

      if (gmMarkersRef.current[m.tripId]) {
        // Update existing marker position
        gmMarkersRef.current[m.tripId].setPosition(pos);
      } else {
        // Create new marker
        const marker = new google.maps.Marker({
          position: pos,
          map: mapRef.current,
          icon: {
            url: createDriverCarIcon(initials, m.accent),
            scaledSize: new google.maps.Size(64, 72),
            anchor: new google.maps.Point(32, 68),
          },
          title: m.driverName,
          zIndex: 10,
        });

        marker.addListener("click", () => {
          const html = `
            <div style="font-family:system-ui,sans-serif;min-width:220px;padding:4px 0;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <div style="width:32px;height:32px;border-radius:50%;background:${m.accent};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;color:#fff;">${initials}</div>
                <div>
                  <div style="font-weight:800;font-size:14px;color:#0f172a;">${m.driverName}</div>
                  <div style="font-size:11px;color:#64748b;">${m.vehiclePlate}</div>
                </div>
              </div>
              <div style="font-size:12px;background:#f8fafc;border-radius:8px;padding:8px 10px;line-height:1.7;margin-bottom:8px;">
                <span style="color:#10b981;">●</span> ${m.origin}<br/>
                <span style="color:#94a3b8;padding-left:4px;">↓</span><br/>
                <span style="color:#ef4444;">●</span> ${m.destination}
              </div>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span style="display:inline-flex;align-items:center;gap:4px;background:${m.accent}22;border:1px solid ${m.accent}55;border-radius:99px;padding:3px 10px;">
                  <span style="width:6px;height:6px;border-radius:50%;background:${m.accent};display:inline-block;"></span>
                  <span style="font-size:11px;font-weight:700;color:${m.accent};">${m.statusLabel}</span>
                </span>
                ${m.elapsedMin !== null ? `<span style="font-size:11px;color:#94a3b8;">⏱ ${m.elapsedMin}m</span>` : ""}
              </div>
              <div style="margin-top:6px;font-size:10px;color:#94a3b8;">GPS ${m.gpsTime}</div>
            </div>
          `;
          infoWindowRef.current.setContent(html);
          infoWindowRef.current.open(mapRef.current, marker);
        });

        gmMarkersRef.current[m.tripId] = marker;
      }
    });

    // Fit bounds on first load with data
    if (markers.length > 0 && !didFitRef.current) {
      const bounds = new google.maps.LatLngBounds();
      markers.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));
      mapRef.current.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
      didFitRef.current = true;
    }
  }, [markers]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: `${height}px`, borderRadius: 12 }} />
  );
}
