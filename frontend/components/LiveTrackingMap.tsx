"use client";

import { useEffect, useRef } from "react";
import { loadGoogleMaps, type LatLng } from "@/lib/google-maps";

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

export type DestinationPin = {
  tripId: string;
  lat: number;
  lng: number;
  label: string;
  accent: string;
};

export type RoutePath = {
  tripId: string;
  path: LatLng[];
  accent: string;
};

type Props = {
  markers: TrackingMarker[];
  destinations?: DestinationPin[];
  routes?: RoutePath[];
  height?: number;
  isDark?: boolean;
  selectedTripId?: string | null;
};

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

function createDriverCarIcon(initials: string, accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="72" viewBox="0 0 64 72">
    <defs>
      <filter id="ds" x="-20%" y="-10%" width="140%" height="130%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.35"/>
      </filter>
    </defs>
    <path d="M32 68 L24 52 L40 52 Z" fill="${accent}" opacity="0.9"/>
    <circle cx="32" cy="28" r="26" fill="${accent}" filter="url(%23ds)"/>
    <circle cx="32" cy="28" r="23" fill="#062240"/>
    <g transform="translate(14,16)">
      <rect x="4" y="10" width="28" height="11" rx="3" fill="${accent}" opacity="0.9"/>
      <path d="M7 10 L11 3 L25 3 L29 10" fill="${accent}" opacity="0.6"/>
      <circle cx="10" cy="21" r="2.5" fill="#062240" stroke="#fff" stroke-width="1.2"/>
      <circle cx="26" cy="21" r="2.5" fill="#062240" stroke="#fff" stroke-width="1.2"/>
      <rect x="1" y="13" width="3" height="2" rx="1" fill="#FFD700" opacity="0.8"/>
      <rect x="32" y="13" width="3" height="2" rx="1" fill="#FF4444" opacity="0.8"/>
    </g>
    <text x="32" y="35" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="900" fill="#fff" letter-spacing="0.5">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createDestinationFlagIcon(accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="56" viewBox="0 0 44 56">
    <defs>
      <filter id="ds2" x="-20%" y="-10%" width="140%" height="130%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.3"/>
      </filter>
    </defs>
    <circle cx="22" cy="20" r="18" fill="${accent}" filter="url(%23ds2)"/>
    <circle cx="22" cy="20" r="15" fill="#fff"/>
    <path d="M22 52 L17 38 L27 38 Z" fill="${accent}"/>
    <path d="M14 11 L14 30 M14 11 L28 11 L25 17 L28 23 L14 23" fill="${accent}" stroke="${accent}" stroke-width="2" stroke-linejoin="round"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export default function LiveTrackingMap({
  markers,
  destinations = [],
  routes = [],
  height = 560,
  selectedTripId,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const gmMarkersRef = useRef<Record<string, any>>({});
  // Last accent applied to each marker — drives icon re-generation when the
  // online/offline color flips (green → red and back).
  const markerAccentRef = useRef<Record<string, string>>({});
  const gmDestinationsRef = useRef<Record<string, any>>({});
  const gmRoutesRef = useRef<Record<string, any>>({});
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
      Object.values(gmDestinationsRef.current).forEach((m: any) => m.setMap(null));
      Object.values(gmRoutesRef.current).forEach((p: any) => p.setMap(null));
      gmMarkersRef.current = {};
      gmDestinationsRef.current = {};
      gmRoutesRef.current = {};
      mapRef.current = null;
      didFitRef.current = false;
    };
  }, []);

  // Update driver markers
  useEffect(() => {
    if (!mapRef.current) return;
    const google = (window as any).google;
    if (!google?.maps) return;

    const currentIds = new Set(markers.map((m) => m.tripId));

    Object.keys(gmMarkersRef.current).forEach((id) => {
      if (!currentIds.has(id)) {
        gmMarkersRef.current[id].setMap(null);
        delete gmMarkersRef.current[id];
        delete markerAccentRef.current[id];
      }
    });

    markers.forEach((m) => {
      const initials = getInitials(m.driverName);
      const pos = { lat: m.lat, lng: m.lng };

      if (gmMarkersRef.current[m.tripId]) {
        gmMarkersRef.current[m.tripId].setPosition(pos);
        // Re-generate the icon when the color changes — disconnection turns
        // the marker red without removing it, reconnection turns it back green.
        if (markerAccentRef.current[m.tripId] !== m.accent) {
          gmMarkersRef.current[m.tripId].setIcon({
            url: createDriverCarIcon(initials, m.accent),
            scaledSize: new google.maps.Size(64, 72),
            anchor: new google.maps.Point(32, 68),
          });
          markerAccentRef.current[m.tripId] = m.accent;
        }
      } else {
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
        markerAccentRef.current[m.tripId] = m.accent;
      }
    });

    // With a single driver visible, follow them: snap-zoom on first sight,
    // pan smoothly afterwards so the marker stays centered as they move.
    if (markers.length === 1) {
      const m = markers[0];
      const target = { lat: m.lat, lng: m.lng };
      if (!didFitRef.current) {
        mapRef.current.setCenter(target);
        if (mapRef.current.getZoom() < 15) mapRef.current.setZoom(16);
        didFitRef.current = true;
      } else {
        mapRef.current.panTo(target);
      }
    } else if (markers.length > 1 && !didFitRef.current) {
      const bounds = new google.maps.LatLngBounds();
      markers.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));
      destinations.forEach((d) => bounds.extend({ lat: d.lat, lng: d.lng }));
      mapRef.current.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
      didFitRef.current = true;
    }
  }, [markers, destinations]);

  // Update destination pins
  useEffect(() => {
    if (!mapRef.current) return;
    const google = (window as any).google;
    if (!google?.maps) return;

    const currentIds = new Set(destinations.map((d) => d.tripId));

    Object.keys(gmDestinationsRef.current).forEach((id) => {
      if (!currentIds.has(id)) {
        gmDestinationsRef.current[id].setMap(null);
        delete gmDestinationsRef.current[id];
      }
    });

    destinations.forEach((d) => {
      const pos = { lat: d.lat, lng: d.lng };
      if (gmDestinationsRef.current[d.tripId]) {
        gmDestinationsRef.current[d.tripId].setPosition(pos);
      } else {
        const marker = new google.maps.Marker({
          position: pos,
          map: mapRef.current,
          icon: {
            url: createDestinationFlagIcon(d.accent),
            scaledSize: new google.maps.Size(44, 56),
            anchor: new google.maps.Point(22, 52),
          },
          title: d.label,
          zIndex: 5,
        });
        gmDestinationsRef.current[d.tripId] = marker;
      }
    });
  }, [destinations]);

  // Update route polylines
  useEffect(() => {
    if (!mapRef.current) return;
    const google = (window as any).google;
    if (!google?.maps) return;

    const currentIds = new Set(routes.map((r) => r.tripId));

    Object.keys(gmRoutesRef.current).forEach((id) => {
      if (!currentIds.has(id)) {
        gmRoutesRef.current[id].setMap(null);
        delete gmRoutesRef.current[id];
      }
    });

    routes.forEach((r) => {
      const existing = gmRoutesRef.current[r.tripId];
      if (existing) {
        existing.setPath(r.path);
        existing.setOptions({ strokeColor: r.accent });
      } else {
        const polyline = new google.maps.Polyline({
          path: r.path,
          map: mapRef.current,
          geodesic: true,
          strokeColor: r.accent,
          strokeOpacity: 0.85,
          strokeWeight: 5,
          zIndex: 2,
        });
        gmRoutesRef.current[r.tripId] = polyline;
      }
    });
  }, [routes]);

  // Highlight selected marker and pan to it
  useEffect(() => {
    if (!mapRef.current) return;
    const google = (window as any).google;
    if (!google?.maps) return;

    markers.forEach((m) => {
      const gm = gmMarkersRef.current[m.tripId];
      if (!gm) return;
      const isSelected = m.tripId === selectedTripId;
      const initials = getInitials(m.driverName);
      gm.setIcon({
        url: createDriverCarIcon(initials, isSelected ? "#f59e0b" : m.accent),
        scaledSize: new google.maps.Size(isSelected ? 80 : 64, isSelected ? 90 : 72),
        anchor: new google.maps.Point(isSelected ? 40 : 32, isSelected ? 90 : 68),
      });
      gm.setZIndex(isSelected ? 100 : 10);
    });

    // Emphasize the selected trip's route
    Object.entries(gmRoutesRef.current).forEach(([tripId, polyline]) => {
      const isSelected = tripId === selectedTripId;
      polyline.setOptions({
        strokeWeight: isSelected ? 7 : 5,
        strokeOpacity: isSelected ? 1 : 0.6,
        zIndex: isSelected ? 4 : 2,
      });
    });

    if (selectedTripId) {
      const selected = markers.find((m) => m.tripId === selectedTripId);
      if (selected) {
        mapRef.current.panTo({ lat: selected.lat, lng: selected.lng });
        if (mapRef.current.getZoom() < 14) mapRef.current.setZoom(14);
      }
    }
  }, [selectedTripId, markers]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: `${height}px`, borderRadius: 12 }} />
  );
}
