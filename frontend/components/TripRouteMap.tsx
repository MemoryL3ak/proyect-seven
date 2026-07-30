"use client";

// Mapa interactivo (Google Maps JS) con el recorrido GPS de un viaje.
// Reemplaza a la imagen de Static Maps del detalle de "Todos los viajes":
// dibuja la polilínea del breadcrumb con marcadores A/B y ajusta el
// encuadre a la ruta. Permite zoom/arrastre como cualquier mapa real.

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps, type LatLng } from "@/lib/google-maps";

type Props = {
  points: LatLng[];
  height?: number | string;
};

export default function TripRouteMap({ points, height = 460 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadGoogleMaps();
      } catch {
        if (!cancelled) setFailed(true);
        return;
      }
      if (cancelled || !containerRef.current) return;
      const google = (window as any).google;
      if (!google?.maps?.Map) {
        setFailed(true);
        return;
      }

      if (!mapRef.current) {
        mapRef.current = new google.maps.Map(containerRef.current, {
          zoom: 13,
          center: points[0] ?? { lat: -33.4489, lng: -70.6693 },
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
      }
      const map = mapRef.current;

      overlaysRef.current.forEach((o) => o.setMap(null));
      overlaysRef.current = [];
      if (points.length < 2) return;

      const line = new google.maps.Polyline({
        path: points,
        strokeColor: "#21D0B3",
        strokeOpacity: 0.95,
        strokeWeight: 5,
        map,
      });
      const marker = (position: LatLng, label: string, color: string) =>
        new google.maps.Marker({
          position,
          map,
          label: { text: label, color: "#ffffff", fontWeight: "700", fontSize: "11px" },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
      overlaysRef.current = [
        line,
        marker(points[0], "A", "#21D0B3"),
        marker(points[points.length - 1], "B", "#ef4444"),
      ];

      const bounds = new google.maps.LatLngBounds();
      points.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, 48);
    })();
    return () => {
      cancelled = true;
    };
  }, [points]);

  if (failed) {
    return (
      <div style={{ width: "100%", height, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13, background: "#eef2f7" }}>
        No se pudo cargar el mapa.
      </div>
    );
  }
  return <div ref={containerRef} style={{ width: "100%", height, background: "#e5eaf0" }} />;
}
