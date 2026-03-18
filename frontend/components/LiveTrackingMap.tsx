"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

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

export default function LiveTrackingMap({ markers, height = 560, isDark = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const didFitRef = useRef(false);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import("leaflet").then((L) => {
      // Fix broken webpack default icons
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current!, {
        center: [-33.45, -70.65],
        zoom: 11,
        zoomControl: true,
      });

      const tileUrl = isDark
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

      const attribution = isDark
        ? '© <a href="https://carto.com/">CARTO</a>'
        : '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

      L.tileLayer(tileUrl, { attribution, maxZoom: 19 }).addTo(map);

      mapRef.current = map;
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        didFitRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers on every data refresh
  useEffect(() => {
    if (!mapRef.current) return;

    import("leaflet").then((L) => {
      // Remove stale markers
      Object.values(markersRef.current).forEach((m: any) => m.remove());
      markersRef.current = {};

      markers.forEach((m) => {
        const icon = L.divIcon({
          html: `
            <div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
              <div style="
                position:absolute;
                width:28px;height:28px;border-radius:50%;
                background:${m.accent}22;
                border:1.5px solid ${m.accent}55;
                animation:liveRing 2s ease-out infinite;
              "></div>
              <div style="
                position:relative;
                width:14px;height:14px;border-radius:50%;
                background:${m.accent};
                border:2.5px solid #ffffff;
                box-shadow:0 0 0 3px ${m.accent}44,0 2px 8px rgba(0,0,0,0.45);
              "></div>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
          className: "",
        });

        const popupHtml = `
          <div style="font-family:system-ui,sans-serif;min-width:210px;padding:2px 0;">
            <div style="font-weight:800;font-size:14px;color:${m.accent};margin-bottom:3px;">🚌 ${m.driverName}</div>
            <div style="font-size:12px;color:#64748b;margin-bottom:8px;">${m.vehiclePlate}</div>
            <div style="font-size:12px;background:#f8fafc;border-radius:8px;padding:8px 10px;line-height:1.7;">
              📍 ${m.origin}<br/>
              <span style="color:#94a3b8;padding-left:8px;">↓</span><br/>
              🏟 ${m.destination}
            </div>
            <div style="margin-top:8px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span style="display:inline-flex;align-items:center;gap:4px;background:${m.accent}15;border:1px solid ${m.accent}40;border-radius:99px;padding:3px 10px;">
                <span style="width:6px;height:6px;border-radius:50%;background:${m.accent};display:inline-block;"></span>
                <span style="font-size:11px;font-weight:700;color:${m.accent};">${m.statusLabel}</span>
              </span>
              ${m.elapsedMin !== null ? `<span style="font-size:11px;color:#94a3b8;">⏱ ${m.elapsedMin}m</span>` : ""}
            </div>
            <div style="margin-top:6px;font-size:10px;color:#94a3b8;">GPS ${m.gpsTime}</div>
          </div>
        `;

        const marker = L.marker([m.lat, m.lng], { icon })
          .bindPopup(popupHtml, { maxWidth: 300, className: "live-tracking-popup" })
          .addTo(mapRef.current);

        markersRef.current[m.tripId] = marker;
      });

      // Fit all markers on first load
      if (markers.length > 0 && !didFitRef.current) {
        const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
        mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
        didFitRef.current = true;
      }
    });
  }, [markers]);

  return (
    <>
      <style>{`
        @keyframes liveRing {
          0%   { transform: scale(1);   opacity: 0.7; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .live-tracking-popup .leaflet-popup-content-wrapper {
          border-radius: 14px !important;
          box-shadow: 0 8px 30px rgba(0,0,0,0.18) !important;
          padding: 4px !important;
        }
        .live-tracking-popup .leaflet-popup-content {
          margin: 10px 12px !important;
        }
        .live-tracking-popup .leaflet-popup-tip-container {
          margin-top: -1px;
        }
      `}</style>
      <div ref={containerRef} style={{ width: "100%", height: `${height}px` }} />
    </>
  );
}
