"use client";

// Componente temporal para demostrar el bridge JS↔Nativo al cliente.
// Borrar este archivo y su import en `app/m/login/page.tsx` cuando termine
// la demostración.

import { useEffect, useRef, useState } from "react";
import { isAvailable, request } from "@/lib/native-bridge";

type DeviceInfo = {
  os: string;
  osVersion: string;
  appVersion: string | null;
  protocol: number;
};

type NotifyResult = { id: string; title: string; body: string; sent: true };

type ModalKind = "device" | "notify" | null;

export default function BridgeDemoButtons() {
  const [open, setOpen] = useState<ModalKind>(null);

  return (
    <div
      style={{
        marginTop: 16,
        padding: 12,
        borderRadius: 12,
        border: "1px dashed rgba(255,255,255,0.18)",
        background: "rgba(255,255,255,0.03)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.4)",
          fontWeight: 600,
          textAlign: "center",
        }}
      >
        Pruebas técnicas (temporal)
      </p>
      <button type="button" onClick={() => setOpen("device")} style={demoBtnStyle}>
        Ver info de dispositivo
      </button>
      <button type="button" onClick={() => setOpen("notify")} style={demoBtnStyle}>
        Enviar notificación local
      </button>

      {open === "device" && <DeviceInfoModal onClose={() => setOpen(null)} />}
      {open === "notify" && <NotifyModal onClose={() => setOpen(null)} />}
    </div>
  );
}

function DeviceInfoModal({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<{
    loading: boolean;
    info: DeviceInfo | null;
    error: string | null;
  }>({ loading: true, info: null, error: null });

  useEffect(() => {
    let cancelled = false;
    if (!isAvailable()) {
      setState({
        loading: false,
        info: null,
        error: "El bridge nativo no está disponible. Abrí esta pantalla desde la app.",
      });
      return;
    }
    request<DeviceInfo>("device.info", undefined, { timeoutMs: 3000 })
      .then((info) => {
        if (!cancelled) setState({ loading: false, info, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setState({ loading: false, info: null, error: msg });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ModalShell title="Info del dispositivo" onClose={onClose}>
      {state.loading && <p style={modalText}>Consultando al nativo…</p>}
      {state.error && <p style={errorText}>{state.error}</p>}
      {state.info && (
        <pre
          style={{
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(52,243,198,0.25)",
            borderRadius: 10,
            padding: 14,
            margin: 0,
            fontSize: 13,
            lineHeight: 1.55,
            color: "#a8f5e0",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            overflow: "auto",
          }}
        >
{JSON.stringify(state.info, null, 2)}
        </pre>
      )}
    </ModalShell>
  );
}

function NotifyModal({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<NotifyResult | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 60);
  }, []);

  const submit = async () => {
    const body = text.trim();
    if (!body) {
      setError("Escribí un mensaje primero.");
      return;
    }
    if (!isAvailable()) {
      setError("El bridge nativo no está disponible. Abrí esta pantalla desde la app.");
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const result = await request<NotifyResult>(
        "notify.local",
        { title: "Seven Arena (demo)", body },
        { timeoutMs: 5000 },
      );
      setSuccess(result);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Notificación local" onClose={onClose}>
      <p style={{ ...modalText, marginBottom: 10 }}>
        Escribí un mensaje y el nativo va a disparar una notificación push local en el dispositivo.
      </p>
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !loading) void submit();
        }}
        placeholder="Tu mensaje…"
        disabled={loading}
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: 10,
          border: `1px solid ${text ? "rgba(52,243,198,0.5)" : "rgba(255,255,255,0.12)"}`,
          background: "rgba(255,255,255,0.06)",
          color: "#f1f5f9",
          fontSize: 14,
          outline: "none",
          boxSizing: "border-box",
        }}
      />
      {error && <p style={errorText}>{error}</p>}
      {success && (
        <p style={{ ...modalText, color: "#a8f5e0", marginTop: 10 }}>
          ✓ Notificación enviada: <strong>{success.body}</strong>
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={loading || !text.trim()}
        style={{
          ...demoBtnStyle,
          marginTop: 6,
          opacity: loading || !text.trim() ? 0.5 : 1,
          cursor: loading || !text.trim() ? "not-allowed" : "pointer",
          background: "linear-gradient(135deg, #34F3C6 0%, #21D0B3 50%, #15B09A 100%)",
          color: "#0d1b3e",
          fontWeight: 700,
          border: "none",
        }}
      >
        {loading ? "Enviando…" : "Disparar notificación"}
      </button>
    </ModalShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,12,24,0.78)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#0a1628",
          border: "1px solid rgba(52,243,198,0.25)",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              border: "none",
              background: "transparent",
              color: "rgba(255,255,255,0.5)",
              fontSize: 22,
              cursor: "pointer",
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const demoBtnStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.06)",
  color: "#f1f5f9",
  fontSize: 13.5,
  fontWeight: 600,
  cursor: "pointer",
};

const modalText: React.CSSProperties = {
  margin: 0,
  fontSize: 13.5,
  lineHeight: 1.55,
  color: "rgba(255,255,255,0.7)",
};

const errorText: React.CSSProperties = {
  margin: 0,
  marginTop: 6,
  fontSize: 13,
  color: "#fca5a5",
};
