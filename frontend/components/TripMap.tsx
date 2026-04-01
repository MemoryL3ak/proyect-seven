"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type LatLng = { lat: number; lng: number };

interface TripMapProps {
  origin?: string | null;
  destination?: string | null;
  driverPosition?: LatLng | null;
  userPosition?: LatLng | null;
  height?: number;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

function createUserIconUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
    <defs><filter id="su" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.25"/></filter></defs>
    <circle cx="22" cy="22" r="20" fill="#2563eb" stroke="#fff" stroke-width="3" filter="url(#su)"/>
    <circle cx="22" cy="16" r="5" fill="#fff"/>
    <path d="M13 31 C13 25 17 22 22 22 C27 22 31 25 31 31" fill="#fff"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createCarIconUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
    <defs><filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.3"/></filter></defs>
    <circle cx="28" cy="28" r="26" fill="#062240" stroke="#21D0B3" stroke-width="3" filter="url(#s)"/>
    <g transform="translate(14,16)">
      <rect x="2" y="8" width="24" height="11" rx="3" fill="#21D0B3"/>
      <path d="M5 8 L8 2 L20 2 L23 8" fill="#34F3C6" stroke="#062240" stroke-width="0.5"/>
      <rect x="9" y="3" width="2" height="5" rx="0.5" fill="#062240" opacity="0.3"/>
      <rect x="17" y="3" width="2" height="5" rx="0.5" fill="#062240" opacity="0.3"/>
      <circle cx="7" cy="19" r="2.5" fill="#062240" stroke="#fff" stroke-width="1.5"/>
      <circle cx="21" cy="19" r="2.5" fill="#062240" stroke="#fff" stroke-width="1.5"/>
      <rect x="0" y="11" width="4" height="2" rx="1" fill="#FFD700"/>
      <rect x="24" y="11" width="4" height="2" rx="1" fill="#FF4444"/>
    </g>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

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

/* ------------------------------------------------------------------ */
/*  Inner map (reused for inline and fullscreen)                       */
/* ------------------------------------------------------------------ */

function MapCanvas({
  origin,
  destination,
  driverPosition,
  userPosition,
  height,
  gestureHandling = "cooperative",
}: TripMapProps & { gestureHandling?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);
  const initKey = useRef("");
  const driverPositionRef = useRef<LatLng | null>(driverPosition ?? null);

  useEffect(() => {
    driverPositionRef.current = driverPosition ?? null;
  }, [driverPosition]);

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;
    const key = `${origin ?? ""}|${destination ?? ""}`;
    if (initKey.current === key && mapRef.current) return;
    initKey.current = key;

    let cancelled = false;

    (async () => {
      try {
        await loadGoogleMaps();
      } catch {
        return;
      }
      if (cancelled || !containerRef.current) return;

      const google = (window as any).google;
      const defaultCenter = { lat: -33.45, lng: -70.65 };

      if (!mapRef.current) {
        mapRef.current = new google.maps.Map(containerRef.current, {
          center: defaultCenter,
          zoom: 11,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling,
        });
      }

      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
        directionsRendererRef.current = null;
      }

      if (cancelled) return;

      const map = mapRef.current;

      if (origin && destination) {
        const directionsService = new google.maps.DirectionsService();
        const renderer = new google.maps.DirectionsRenderer({
          suppressMarkers: false,
          polylineOptions: { strokeColor: "#21D0B3", strokeWeight: 4 },
        });
        renderer.setMap(map);
        directionsRendererRef.current = renderer;

        directionsService.route(
          { origin, destination, travelMode: google.maps.TravelMode.DRIVING },
          (result: any, status: string) => {
            if (cancelled) return;
            if (status === "OK") {
              renderer.setDirections(result);
            } else {
              const geocoder = new google.maps.Geocoder();
              geocoder.geocode({ address: origin }, (results: any, st: string) => {
                if (cancelled || st !== "OK" || !results?.[0]) return;
                map.setCenter(results[0].geometry.location);
                map.setZoom(13);
                new google.maps.Marker({ position: results[0].geometry.location, map, label: "A" });
              });
            }
          },
        );
      } else if (origin || destination) {
        const addr = origin || destination;
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: addr }, (results: any, status: string) => {
          if (cancelled || status !== "OK" || !results?.[0]) return;
          map.setCenter(results[0].geometry.location);
          map.setZoom(14);
          new google.maps.Marker({ position: results[0].geometry.location, map });
        });
      }

      const latestDriverPos = driverPositionRef.current;
      if (latestDriverPos) {
        if (driverMarkerRef.current) {
          driverMarkerRef.current.setPosition(latestDriverPos);
        } else {
          driverMarkerRef.current = new google.maps.Marker({
            position: latestDriverPos,
            map,
            icon: {
              url: createCarIconUrl(),
              scaledSize: new google.maps.Size(56, 56),
              anchor: new google.maps.Point(28, 28),
            },
            title: "Conductor",
            zIndex: 10,
          });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [origin, destination, gestureHandling]);

  useEffect(() => {
    if (!mapRef.current || !driverPosition) return;
    const google = (window as any).google;
    if (!google?.maps) return;

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setPosition(driverPosition);
    } else {
      driverMarkerRef.current = new google.maps.Marker({
        position: driverPosition,
        map: mapRef.current,
        icon: {
          url: createCarIconUrl(),
          scaledSize: new google.maps.Size(56, 56),
          anchor: new google.maps.Point(28, 28),
        },
        title: "Conductor",
        zIndex: 10,
      });
    }
  }, [driverPosition]);

  useEffect(() => {
    if (!mapRef.current || !userPosition) return;
    const google = (window as any).google;
    if (!google?.maps) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setPosition(userPosition);
    } else {
      userMarkerRef.current = new google.maps.Marker({
        position: userPosition,
        map: mapRef.current,
        icon: {
          url: createUserIconUrl(),
          scaledSize: new google.maps.Size(44, 44),
          anchor: new google.maps.Point(22, 22),
        },
        title: "Tu ubicación",
        zIndex: 9,
      });
    }
  }, [userPosition]);

  useEffect(() => {
    return () => {
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
        directionsRendererRef.current = null;
      }
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setMap(null);
        driverMarkerRef.current = null;
      }
      if (userMarkerRef.current) {
        userMarkerRef.current.setMap(null);
        userMarkerRef.current = null;
      }
      mapRef.current = null;
      initKey.current = "";
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ height: height ?? "100%", width: "100%", background: "#e5e3df" }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Main export: inline map + expand button + fullscreen modal         */
/* ------------------------------------------------------------------ */

export default function TripMap(props: TripMapProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      {/* Inline map with expand button */}
      <div style={{ position: "relative" }}>
        <MapCanvas {...props} gestureHandling="cooperative" />
        {/* Expand button */}
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={{
            position: "absolute",
            bottom: 10,
            right: 10,
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "rgba(255,255,255,0.95)",
            border: "1px solid #e2e8f0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 5,
          }}
          title="Ampliar mapa"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
      </div>

      {/* Fullscreen modal */}
      {expanded && createPortal(
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "#000",
            display: "flex",
            flexDirection: "column",
            animation: "tripMapExpandIn .25s ease both",
          }}
        >
          {/* Header */}
          <div style={{
            padding: "10px 14px",
            paddingTop: "calc(10px + env(safe-area-inset-top, 0px))",
            background: "linear-gradient(135deg, #30455B, #243550)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>Mapa del viaje</span>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Full map */}
          <div style={{ flex: 1 }}>
            <MapCanvas
              {...props}
              height={undefined}
              gestureHandling="greedy"
            />
          </div>

          {/* Legend */}
          <div style={{
            padding: "8px 14px",
            paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
            background: "#1e293b",
            display: "flex",
            gap: 16,
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#21D0B3", border: "2px solid #062240" }} />
              <span style={{ fontSize: 11, color: "#94a3b8" }}>Conductor</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#2563eb", border: "2px solid #fff" }} />
              <span style={{ fontSize: 11, color: "#94a3b8" }}>Tu posición</span>
            </div>
          </div>

          <style>{`
            @keyframes tripMapExpandIn {
              from { opacity: 0; transform: scale(0.95); }
              to { opacity: 1; transform: scale(1); }
            }
          `}</style>
        </div>,
        document.body,
      )}
    </>
  );
}
