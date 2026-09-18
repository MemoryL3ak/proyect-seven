"use client";

import { useCallback, useEffect, useState } from "react";
import { isAvailable, on, request } from "@/lib/native-bridge";
import { SatelliteIcon } from "@/components/ui/Icons";
import { BRAND, SURFACE, STATE } from "@/lib/design";

type PushState = {
  lastAttemptAt: number | null;
  lastSuccessAt: number | null;
  lastStatus: number | null;
  lastError: string | null;
  queueSize?: number;
};
type StartResult = {
  ok: boolean;
  foreground: string;
  background: string;
  gpsServices: boolean;
  immediate: boolean;
  running: boolean;
};
type StatusResult = {
  running: boolean;
  gpsServices: boolean;
  lastPush?: PushState;
};

type Props = {
  driverId: string | null;
};

export default function TrackingToggle({ driverId }: Props) {
  const [native, setNative] = useState<boolean | null>(null);
  const [running, setRunning] = useState<boolean | null>(null);
  const [gpsServices, setGpsServices] = useState<boolean | null>(null);
  const [lastPush, setLastPush] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setNative(isAvailable());
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!isAvailable()) return;
    try {
      const res = await request<StatusResult>("tracking.status", undefined, {
        timeoutMs: 3000,
      });
      setRunning(res.running);
      setGpsServices(res.gpsServices);
      if (res.lastPush) setLastPush(res.lastPush);
    } catch {
      setRunning(false);
      setGpsServices(null);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  // The native shell pings us when the OS GPS toggle flips so the chip
  // updates without waiting for the next tracking.status round-trip.
  useEffect(() => {
    if (!isAvailable()) return;
    const off = on("tracking.statusChanged", (payload) => {
      const data = payload as Partial<StatusResult> | undefined;
      if (!data) return;
      if (typeof data.running === "boolean") setRunning(data.running);
      if (typeof data.gpsServices === "boolean") setGpsServices(data.gpsServices);
      if (data.lastPush) setLastPush(data.lastPush);
    });
    return () => off();
  }, []);

  const handleStart = async () => {
    if (!driverId) {
      setFeedback("No se pudo identificar el conductor.");
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const res = await request<StartResult>(
        "tracking.start",
        { driverId },
        { timeoutMs: 30_000 },
      );
      setGpsServices(res.gpsServices);
      if (!res.ok) {
        if (res.foreground !== "granted") {
          setFeedback(
            "Tenés que aceptar el permiso de ubicación. Si te aparece bloqueado, abrí Ajustes de la app.",
          );
        } else if (!res.gpsServices) {
          setFeedback(
            "El GPS del sistema está apagado. Activalo en el panel desplegable o tocá de nuevo para que aparezca el diálogo.",
          );
        } else {
          setFeedback("No se pudo iniciar el tracking.");
        }
        setRunning(false);
        return;
      }
      setRunning(true);
      const bgNote =
        res.background === "granted"
          ? "incluyendo segundo plano"
          : "solo con la app abierta";
      setFeedback(
        res.immediate
          ? `Tracking activo (${bgNote}). Tu posición ya fue enviada al admin.`
          : `Tracking activo (${bgNote}). Esperando primer fix del GPS…`,
      );
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : "Falló la activación del tracking.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      await request("tracking.stop", undefined, { timeoutMs: 5000 });
      setRunning(false);
      setFeedback("Tracking detenido.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "No se pudo detener.");
    } finally {
      setBusy(false);
    }
  };

  if (native === false) return null;

  const isOn = running === true;
  const gpsOff = gpsServices === false;
  const transmitting = isOn && gpsServices === true;

  let chipLabel: string;
  let chipBg: string;
  let chipColor: string;
  if (transmitting) {
    chipLabel = "● Transmitiendo";
    chipBg = "rgba(33,208,179,0.14)";
    chipColor = BRAND.tealInk;
  } else if (isOn && gpsOff) {
    chipLabel = "GPS apagado";
    chipBg = "rgba(234,179,8,0.16)";
    chipColor = STATE.warningText;
  } else {
    chipLabel = "Inactivo";
    chipBg = SURFACE.borderMuted;
    chipColor = SURFACE.textMuted;
  }

  const btnLabel = busy
    ? "Procesando…"
    : isOn
      ? "Detener tracking"
      : gpsOff
        ? "Activar GPS y enviar ubicación"
        : "Activar GPS y enviar ubicación";

  return (
    <div
      style={{
        background: SURFACE.card,
        borderRadius: 14,
        border: `1px solid ${SURFACE.border}`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: `1px solid ${SURFACE.borderMuted}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ display: "inline-flex" }}><SatelliteIcon size={16} /></span>
        <div style={{ flex: 1 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 700,
              color: SURFACE.text,
            }}
          >
            Tracking GPS
          </p>
          <p
            style={{
              margin: "2px 0 0",
              fontSize: 11.5,
              color: SURFACE.textMuted,
            }}
          >
            Enviá tu ubicación al panel del admin
          </p>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: 6,
            background: chipBg,
            color: chipColor,
          }}
        >
          {chipLabel}
        </span>
      </div>

      <div style={{ padding: "14px" }}>
        <p
          style={{
            margin: "0 0 12px",
            fontSize: 12.5,
            color: SURFACE.textSecondary,
            lineHeight: 1.5,
          }}
        >
          Tocá el botón para activar el GPS y empezar a enviar tu posición en
          tiempo real. La app va a pedirte permiso de ubicación y, si hace
          falta, te va a mostrar el diálogo para encender el GPS sin salir.
        </p>
        {isOn && gpsOff && (
          <p
            style={{
              margin: "0 0 10px",
              padding: "8px 10px",
              borderRadius: 8,
              background: "rgba(234,179,8,0.12)",
              border: "1px solid rgba(234,179,8,0.35)",
              fontSize: 11.5,
              color: STATE.warningText,
              lineHeight: 1.45,
            }}
          >
            El tracking está armado pero el GPS del sistema está apagado. No se
            están enviando posiciones al admin. Tocá el botón para que el
            sistema te pida encenderlo.
          </p>
        )}
        <button
          type="button"
          disabled={busy || !driverId}
          onClick={isOn && !gpsOff ? handleStop : handleStart}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 10,
            border: "none",
            background:
              isOn && !gpsOff
                ? STATE.dangerSoft
                : `linear-gradient(135deg,${BRAND.teal},#14AE98)`,
            color: isOn && !gpsOff ? STATE.dangerText : SURFACE.card,
            fontSize: 13,
            fontWeight: 700,
            cursor: busy ? "wait" : "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {isOn && !gpsOff ? "Detener tracking" : btnLabel}
        </button>
        {feedback && (
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 11.5,
              color: transmitting ? BRAND.tealInk : SURFACE.textSecondary,
              lineHeight: 1.5,
            }}
          >
            {feedback}
          </p>
        )}
        {lastPush && (lastPush.lastAttemptAt || lastPush.lastError) && (
          <div
            style={{
              marginTop: 10,
              padding: "8px 10px",
              borderRadius: 8,
              background: lastPush.lastError ? "rgba(239,68,68,0.08)" : SURFACE.bg,
              border: `1px solid ${
                lastPush.lastError ? "rgba(239,68,68,0.25)" : "#e2e8f0"
              }`,
              fontSize: 11,
              lineHeight: 1.5,
              color: lastPush.lastError ? STATE.dangerText : SURFACE.textSecondary,
            }}
          >
            <p style={{ margin: 0, fontWeight: 700 }}>
              Diagnóstico de red
            </p>
            <p style={{ margin: "2px 0 0" }}>
              Último intento:{" "}
              {lastPush.lastAttemptAt
                ? new Date(lastPush.lastAttemptAt).toLocaleTimeString("es-CL")
                : "—"}
            </p>
            <p style={{ margin: "2px 0 0" }}>
              Último envío OK:{" "}
              {lastPush.lastSuccessAt
                ? new Date(lastPush.lastSuccessAt).toLocaleTimeString("es-CL")
                : "—"}
            </p>
            {lastPush.lastError && (
              <p style={{ margin: "2px 0 0" }}>
                Error: <strong>{lastPush.lastError}</strong>
                {lastPush.lastStatus ? ` (HTTP ${lastPush.lastStatus})` : ""}
              </p>
            )}
            {typeof lastPush.queueSize === "number" && lastPush.queueSize > 0 && (
              <p style={{ margin: "2px 0 0" }}>
                En cola para reenviar al recuperar red: <strong>{lastPush.queueSize}</strong>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
