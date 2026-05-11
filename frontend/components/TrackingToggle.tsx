"use client";

import { useCallback, useEffect, useState } from "react";
import { isAvailable, request } from "@/lib/native-bridge";

type StartResult = {
  ok: boolean;
  foreground: string;
  background: string;
  immediate: boolean;
  running: boolean;
};
type StatusResult = { running: boolean };

type Props = {
  driverId: string | null;
};

export default function TrackingToggle({ driverId }: Props) {
  const [native, setNative] = useState<boolean | null>(null);
  const [running, setRunning] = useState<boolean | null>(null);
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
    } catch {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

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
      if (!res.ok) {
        setFeedback(
          res.foreground !== "granted"
            ? "Tenés que aceptar el permiso de ubicación primero."
            : "No se pudo iniciar el tracking.",
        );
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
        <span style={{ fontSize: 16 }}>🛰️</span>
        <div style={{ flex: 1 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            Tracking GPS
          </p>
          <p
            style={{
              margin: "2px 0 0",
              fontSize: 11.5,
              color: "#64748b",
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
            background: isOn ? "rgba(33,208,179,0.14)" : "#f1f5f9",
            color: isOn ? "#0a7a6b" : "#64748b",
          }}
        >
          {isOn ? "● Activo" : "Inactivo"}
        </span>
      </div>

      <div style={{ padding: "14px" }}>
        <p
          style={{
            margin: "0 0 12px",
            fontSize: 12.5,
            color: "#475569",
            lineHeight: 1.5,
          }}
        >
          Tocá el botón para activar el GPS y empezar a enviar tu posición en
          tiempo real. La app va a pedirte permiso de ubicación si no lo aceptaste
          antes.
        </p>
        <button
          type="button"
          disabled={busy || !driverId}
          onClick={isOn ? handleStop : handleStart}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 10,
            border: "none",
            background: isOn
              ? "#fee2e2"
              : "linear-gradient(135deg,#21D0B3,#14AE98)",
            color: isOn ? "#b91c1c" : "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: busy ? "wait" : "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy
            ? "Procesando…"
            : isOn
              ? "Detener tracking"
              : "Activar GPS y enviar ubicación"}
        </button>
        {feedback && (
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 11.5,
              color: isOn ? "#0a7a6b" : "#475569",
              lineHeight: 1.5,
            }}
          >
            {feedback}
          </p>
        )}
      </div>
    </div>
  );
}
