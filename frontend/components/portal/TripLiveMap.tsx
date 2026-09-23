"use client";

import { useEffect, useState } from "react";
import LiveTrackingMap from "@/components/LiveTrackingMap";
import TripMap from "@/components/TripMap";
import { apiFetch } from "@/lib/api";
import { STATE, SURFACE } from "@/lib/design";
import { horaEvento } from "@/lib/hora-evento";
import { useI18n } from "@/lib/i18n";

/**
 * El bus de un viaje en curso, en vivo, dentro de la tarjeta del viaje.
 *
 * Lo ven el Jefe de Misión y los coordinadores al abrir un traslado que va en
 * ruta: antes la tarjeta abierta mostraba sólo la ruta planificada (A → B) y
 * para ver el bus había que ir a Flota, que además sólo tiene el jefe.
 *
 * Pide la última posición del viaje cada 5 s (el backend cae a la del chofer
 * si el fix no vino etiquetado con el viaje). Mientras no haya posición se
 * muestra la ruta planificada con un aviso, que es lo normal al inicio del
 * viaje; si la señal tiene más de dos minutos, el marcador se pone rojo y se
 * dice hace cuánto.
 */
type Fix = { lat: number; lng: number; timestamp: string };

const POLL_MS = 5000;
const SIN_SENAL_S = 120;

// Acepta las formas en que llega una posición: lat/lng al tope o GeoJSON.
const leerFix = (pos: unknown): Fix | null => {
  const p = pos as { lat?: unknown; lng?: unknown; timestamp?: unknown; location?: { coordinates?: unknown } } | null;
  if (!p) return null;
  const ts = typeof p.timestamp === "string" ? p.timestamp : new Date().toISOString();
  if (typeof p.lat === "number" && typeof p.lng === "number") return { lat: p.lat, lng: p.lng, timestamp: ts };
  const c = p.location?.coordinates;
  if (Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number") {
    return { lat: c[1], lng: c[0], timestamp: ts };
  }
  return null;
};

export default function TripLiveMap({
  tripId,
  status,
  driverName,
  vehiclePlate,
  origin,
  destination,
  height = 300,
}: {
  tripId: string;
  status?: string | null;
  driverName?: string | null;
  vehiclePlate?: string | null;
  origin?: string | null;
  destination?: string | null;
  height?: number;
}) {
  const { t } = useI18n();
  const [fix, setFix] = useState<Fix | null>(null);
  const [fallo, setFallo] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    let vivo = true;
    const pedir = async () => {
      try {
        const pos = await apiFetch<unknown>(`/vehicle-positions/by-trip/${tripId}/latest`);
        if (!vivo) return;
        const f = leerFix(pos);
        if (f) setFix(f);
        setFallo(false);
      } catch {
        if (vivo) setFallo(true);
      }
      if (vivo) setAhora(Date.now());
    };
    void pedir();
    const timer = setInterval(() => void pedir(), POLL_MS);
    return () => {
      vivo = false;
      clearInterval(timer);
    };
  }, [tripId]);

  const nota = (texto: string) => (
    <p style={{ fontSize: 11, color: SURFACE.textMuted, margin: 0 }}>{texto}</p>
  );

  if (!fix) {
    // Sin ninguna posición del chofer no hay bus que dibujar: se muestra la
    // ruta planificada y se dice por qué, para que el jefe no busque un
    // marcador que no está.
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ borderRadius: 10, overflow: "hidden" }}>
          <TripMap origin={origin} destination={destination} height={height} />
        </div>
        <p style={{ fontSize: 11.5, fontWeight: 600, color: fallo ? STATE.danger : STATE.warningText, margin: 0 }}>
          {fallo
            ? t("No se pudo leer la posición del bus.")
            : t("El conductor no ha enviado ninguna posición todavía: el bus aparece cuando su app transmita el GPS.")}
        </p>
      </div>
    );
  }

  const edadS = Math.max(0, Math.round((ahora - new Date(fix.timestamp).getTime()) / 1000));
  const conSenal = edadS <= SIN_SENAL_S;
  const estado = String(status ?? "").toUpperCase() === "PICKED_UP" ? t("Pasajero a bordo") : t("Va en camino");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ borderRadius: 10, overflow: "hidden" }}>
        <LiveTrackingMap
          height={height}
          selectedTripId={tripId}
          sinBurbuja
          markers={[
            {
              tripId,
              lat: fix.lat,
              lng: fix.lng,
              driverName: driverName ?? t("Conductor"),
              vehiclePlate: vehiclePlate ?? "",
              statusLabel: estado,
              accent: conSenal ? STATE.success : STATE.danger,
              origin: origin ?? "",
              destination: destination ?? "",
              elapsedMin: null,
              gpsTime: horaEvento(fix.timestamp),
            },
          ]}
        />
      </div>
      {conSenal ? (
        nota(`${t("En vivo")} · ${t("última señal")} ${horaEvento(fix.timestamp)}`)
      ) : (
        <p style={{ fontSize: 11.5, fontWeight: 600, color: STATE.danger, margin: 0 }}>
          {t("Sin señal hace")} {Math.round(edadS / 60)} min · {t("última")} {horaEvento(fix.timestamp)} ·{" "}
          {t("el bus se muestra donde estaba entonces")}
        </p>
      )}
    </div>
  );
}
