"use client";

// Mapa interactivo (Google Maps JS) con el recorrido GPS de un viaje.
// Reemplaza a la imagen de Static Maps del detalle de "Todos los viajes":
// dibuja la polilínea del breadcrumb con marcadores A/B y ajusta el
// encuadre a la ruta. Permite zoom/arrastre como cualquier mapa real.
//
// Los fijos se muestran de inmediato como línea tenue; encima se dibuja el
// trazado por calles de cada tramo (lib/ruta-realizada) cuando llega. Antes
// sólo se unían los fijos con rectas, y con fijos a kilómetros la "ruta"
// cruzaba cerros y mar.

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps, splitTrail, type LatLng, type TrailPoint } from "@/lib/google-maps";
import { trazarPorCalles } from "@/lib/ruta-realizada";
import { BRAND, STATE, SURFACE } from "@/lib/design";

type Props = {
  points: TrailPoint[];
  height?: number | string;
  /** Identifica el viaje: el trazado por calles se guarda en el navegador y no se vuelve a pedir. */
  cacheKey?: string;
  /** Kilómetros del trazado dibujado (por calles cuando se pudo), al terminar. */
  onDistancia?: (km: number) => void;
};

export default function TripRouteMap({ points, height = 460, cacheKey, onDistancia }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const onDistanciaRef = useRef(onDistancia);
  onDistanciaRef.current = onDistancia;
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

      // Una polilínea por tramo: los saltos que el auto no pudo haber hecho
      // quedan como un hueco, no como una recta cruzando la ciudad.
      const segments = splitTrail(points).filter((segment) => segment.length >= 2);
      const linea = (path: LatLng[], tenue: boolean) =>
        new google.maps.Polyline({
          path,
          strokeColor: BRAND.teal,
          strokeOpacity: tenue ? 0.3 : 0.95,
          strokeWeight: tenue ? 3 : 5,
          map,
        });
      const crudas = segments.map((segment) => linea(segment, true));
      const marker = (position: LatLng, label: string, color: string) =>
        new google.maps.Marker({
          position,
          map,
          label: { text: label, color: SURFACE.card, fontWeight: "700", fontSize: "11px" },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: SURFACE.card,
            strokeWeight: 2,
          },
        });
      // A y B siguen siendo el primer y el último fijo del viaje: el hueco
      // está en el medio, no en los extremos.
      overlaysRef.current = [
        ...crudas,
        marker(points[0], "A", BRAND.teal),
        marker(points[points.length - 1], "B", STATE.danger),
      ];

      const bounds = new google.maps.LatLngBounds();
      points.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, 48);

      // Trazado por calles, tramo a tramo. Cada uno reemplaza su línea tenue
      // apenas llega; al final se informa el largo real del dibujo.
      let metros = 0;
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const clave = cacheKey ? `${cacheKey}@${segment[0].ts}#${segment.length}` : undefined;
        const trazado = await trazarPorCalles(segment, clave);
        if (cancelled) return;
        metros += trazado.metros;
        if (!trazado.ajustado) {
          crudas[i].setOptions({ strokeOpacity: 0.95, strokeWeight: 5 });
          continue;
        }
        crudas[i].setMap(null);
        const ajustada = linea(trazado.path, false);
        overlaysRef.current.push(ajustada);
        trazado.path.forEach((p) => bounds.extend(p));
      }
      map.fitBounds(bounds, 48);
      onDistanciaRef.current?.(metros / 1000);
    })();
    return () => {
      cancelled = true;
    };
  }, [points, cacheKey]);

  if (failed) {
    return (
      <div style={{ width: "100%", height, display: "flex", alignItems: "center", justifyContent: "center", color: SURFACE.textFaint, fontSize: 13, background: SURFACE.borderMuted }}>
        No se pudo cargar el mapa.
      </div>
    );
  }
  return <div ref={containerRef} style={{ width: "100%", height, background: "#e5eaf0" }} />;
}
