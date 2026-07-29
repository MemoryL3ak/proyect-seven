"use client";

import { useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { isAvailable as nativeAvailable } from "@/lib/native-bridge";
import { getDeviceLocation } from "@/lib/device-location";

/**
 * Tracking permanente del usuario VIP: mientras el portal está abierto,
 * reporta la ubicación del teléfono cada minuto (y al volver a primer plano)
 * a POST /vip-monitoring/position — con o sin viaje activo. En la app nativa
 * usa el GPS del shell vía puente; en navegador, la geolocalización web.
 * Silencioso: si no hay permiso o falla, simplemente no reporta.
 */
const INTERVAL_MS = 60_000;
const MIN_GAP_MS = 20_000;

export default function VipLocationReporter({ athleteId }: { athleteId: string | null }) {
  const lastSent = useRef(0);

  useEffect(() => {
    if (!athleteId) return;
    let cancelled = false;

    const report = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      if (Date.now() - lastSent.current < MIN_GAP_MS) return;
      try {
        let lat: number | null = null;
        let lng: number | null = null;
        let accuracy: number | null = null;
        if (nativeAvailable()) {
          const loc = await getDeviceLocation();
          lat = loc.lat;
          lng = loc.lng;
          accuracy = loc.accuracy ?? null;
        } else if (navigator.geolocation) {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10_000,
              maximumAge: 30_000,
            }),
          );
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
          accuracy = pos.coords.accuracy ?? null;
        }
        if (lat == null || lng == null || cancelled) return;
        lastSent.current = Date.now();
        await apiFetch("/vip-monitoring/position", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ athleteId, lat, lng, accuracy }),
        });
      } catch {
        // Sin permiso de ubicación o sin red: reintentará en el próximo ciclo.
      }
    };

    void report();
    const timer = window.setInterval(() => void report(), INTERVAL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void report();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [athleteId]);

  return null;
}
