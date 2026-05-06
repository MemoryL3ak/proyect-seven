"use client";

import { useEffect, useRef, useState } from "react";
import {
  getDeviceLocation,
  LocationPermissionError,
  type DeviceLocation,
} from "@/lib/device-location";
import {
  isNativeAvailable,
  openDeviceSettings,
  requestDevicePermission,
} from "@/lib/device-permissions";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return;
    const w = window as unknown as { google?: { maps?: { Map?: unknown } } };
    if (w.google?.maps?.Map) {
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

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; location: DeviceLocation }
  | { kind: "blocked" }
  | { kind: "denied" }
  | { kind: "error"; message: string };

export default function MyLocationMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);
  const markerRef = useRef<unknown>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    setAvailable(isNativeAvailable());
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!containerRef.current) return;
    (async () => {
      try {
        await loadGoogleMaps();
      } catch {
        if (!cancelled) {
          setStatus({
            kind: "error",
            message: "No se pudo cargar el mapa.",
          });
        }
        return;
      }
      if (cancelled || !containerRef.current) return;
      const google = (window as unknown as { google: any }).google;
      // Default: Santiago, Chile (project context).
      const defaultCenter = { lat: -33.45, lng: -70.65 };
      mapRef.current = new google.maps.Map(containerRef.current, {
        center: defaultCenter,
        zoom: 11,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "cooperative",
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dropMarker = (loc: DeviceLocation) => {
    const google = (window as unknown as { google?: any }).google;
    if (!google || !mapRef.current) return;
    const map = mapRef.current as any;
    const position = { lat: loc.lat, lng: loc.lng };
    if (markerRef.current) {
      (markerRef.current as any).setPosition(position);
    } else {
      markerRef.current = new google.maps.Marker({
        position,
        map,
        title: "Tu ubicación",
      });
    }
    map.setCenter(position);
    map.setZoom(16);
  };

  const captureLocation = async (): Promise<void> => {
    setStatus({ kind: "loading" });
    try {
      const loc = await getDeviceLocation();
      dropMarker(loc);
      setStatus({ kind: "ok", location: loc });
    } catch (err) {
      if (err instanceof LocationPermissionError) {
        // Permission missing — try to request it (or send to settings if blocked).
        const next = await requestDevicePermission("location");
        if (next === "granted") {
          try {
            const loc = await getDeviceLocation();
            dropMarker(loc);
            setStatus({ kind: "ok", location: loc });
            return;
          } catch (err2) {
            const msg =
              err2 instanceof Error ? err2.message : "Error obteniendo ubicación";
            setStatus({ kind: "error", message: msg });
            return;
          }
        }
        if (next === "blocked") {
          setStatus({ kind: "blocked" });
          return;
        }
        setStatus({ kind: "denied" });
        return;
      }
      const msg = err instanceof Error ? err.message : "Error obteniendo ubicación";
      setStatus({ kind: "error", message: msg });
    }
  };

  if (available === false) {
    // Outside the app the bridge can't reach native location.
    return null;
  }

  const buttonLabel =
    status.kind === "loading"
      ? "Capturando…"
      : status.kind === "blocked"
        ? "Abrir ajustes para activar GPS"
        : "Capturar mi ubicación actual";

  const handleClick = () => {
    if (status.kind === "loading") return;
    if (status.kind === "blocked") {
      openDeviceSettings();
      return;
    }
    void captureLocation();
  };

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        border: "1px solid #e2e8f0",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid #f1f5f9",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 16 }}>🗺️</span>
        <div style={{ flex: 1 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            Mi ubicación
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#64748b" }}>
            Capturá tu posición actual desde el GPS del dispositivo
          </p>
        </div>
      </div>

      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: 200,
          background: "#f1f5f9",
        }}
      />

      <div
        style={{
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {status.kind === "ok" && (
          <div
            style={{
              fontSize: 11.5,
              color: "#0a7a6b",
              background: "rgba(33,208,179,0.08)",
              border: "1px solid rgba(33,208,179,0.25)",
              borderRadius: 8,
              padding: "6px 8px",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          >
            ✓ {status.location.lat.toFixed(5)}, {status.location.lng.toFixed(5)}
            {status.location.accuracy != null && (
              <> · ±{Math.round(status.location.accuracy)} m</>
            )}
          </div>
        )}
        {status.kind === "denied" && (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "#92400E",
              background: "#FEF3C7",
              borderRadius: 8,
              padding: "6px 8px",
            }}
          >
            Necesitamos tu permiso para acceder al GPS. Tocá el botón otra vez.
          </p>
        )}
        {status.kind === "blocked" && (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "#b91c1c",
              background: "#FEE2E2",
              borderRadius: 8,
              padding: "6px 8px",
            }}
          >
            Permiso de ubicación bloqueado. Abrí Ajustes para activarlo.
          </p>
        )}
        {status.kind === "error" && (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "#b91c1c",
              background: "#FEE2E2",
              borderRadius: 8,
              padding: "6px 8px",
            }}
          >
            {status.message}
          </p>
        )}

        <button
          type="button"
          disabled={status.kind === "loading"}
          onClick={handleClick}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "none",
            background:
              status.kind === "blocked"
                ? "#92400E"
                : "linear-gradient(135deg,#21D0B3,#14AE98)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: status.kind === "loading" ? "not-allowed" : "pointer",
            opacity: status.kind === "loading" ? 0.6 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          📍 {buttonLabel}
        </button>
      </div>
    </div>
  );
}
